"""AgencyReport - Reporting automatizado para agencias de marketing."""

import asyncio
import hashlib
import logging
import os
import secrets
import subprocess
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import time as now
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DATABASE_URL, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.database import Base, engine, get_db, SessionLocal
from app.models import Agency, Client, Metric, Alert, Report
from app.services.mock_data import DEMO_CLIENTS, generate_metrics

log = logging.getLogger("agencyreport")

# ---------------------------------------------------------------------------
# Rate limiter (in-memory, simple)
# ---------------------------------------------------------------------------

_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_AI = 10  # max requests per hour


def _check_rate_limit(key: str) -> bool:
    cutoff = now() - 3600
    _rate_limits[key] = [t for t in _rate_limits[key] if t > cutoff]
    if len(_rate_limits[key]) >= RATE_LIMIT_AI:
        return False
    _rate_limits[key].append(now())
    return True


# ---------------------------------------------------------------------------
# Lifespan: create tables + seed demo data
# ---------------------------------------------------------------------------

def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


async def _seed_demo(db: AsyncSession):
    result = await db.execute(select(func.count()).select_from(Agency))
    if result.scalar():
        return

    admin_pw = os.environ.get("ADMIN_PASSWORD", "") or secrets.token_urlsafe(12)
    log.warning("Admin creado: email=admin@agency.test password=%s", admin_pw)

    agency = Agency(
        name="Demo Agency",
        email="admin@agency.test",
        password_hash=_hash_password(admin_pw),
        brand_color="#2563eb",
    )
    db.add(agency)
    await db.flush()

    for client_data in DEMO_CLIENTS:
        client = Client(
            agency_id=agency.id,
            name=client_data["name"],
            industry=client_data["industry"],
            channels=client_data["channels"],
        )
        db.add(client)
        await db.flush()

        for m in generate_metrics(client_data["channels"], days=90):
            db.add(Metric(client_id=client.id, **m))

        first_channel = next(iter(client_data["channels"]))
        db.add(Alert(
            client_id=client.id,
            channel=first_channel,
            metric_name="engagement_rate" if "instagram" in client_data["channels"] else "clicks",
            threshold=2.0,
            condition="below",
        ))

    await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await _seed_demo(db)
    yield


app = FastAPI(title="AgencyReport", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    agency_name: str
    agency_id: str

class ClientOut(BaseModel):
    id: str
    name: str
    industry: str
    channels: dict
    created_at: datetime

class MetricOut(BaseModel):
    channel: str
    metric_name: str
    value: float
    date: datetime

class DashboardOverview(BaseModel):
    total_clients: int
    active_alerts: int
    total_metrics_today: int
    clients: list[ClientOut]

class ReportRequest(BaseModel):
    client_id: str
    period_days: int = 30
    channels: list[str] = []

class ReportOut(BaseModel):
    id: str
    title: str
    period_start: datetime
    period_end: datetime
    ai_summary: str | None
    channels: list
    created_at: datetime

class AlertOut(BaseModel):
    id: str
    client_name: str
    channel: str
    metric_name: str
    threshold: float
    condition: str
    triggered: bool

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    status: str


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def _create_token(agency_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": agency_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def _get_current_agency(request: Request, db: AsyncSession = Depends(get_db)) -> Agency:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    token = auth[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        agency_id = payload.get("sub")
        if not agency_id:
            raise HTTPException(401, "Token invalido")
    except JWTError:
        raise HTTPException(401, "Token expirado o invalido")

    result = await db.execute(select(Agency).where(Agency.id == UUID(agency_id)))
    agency = result.scalar_one_or_none()
    if not agency:
        raise HTTPException(401, "Agencia no encontrada")
    return agency


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "agencyreport"}


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agency).where(Agency.email == req.email))
    agency = result.scalar_one_or_none()
    if not agency or agency.password_hash != _hash_password(req.password):
        raise HTTPException(401, "Credenciales invalidas")
    token = _create_token(str(agency.id))
    return TokenResponse(access_token=token, agency_name=agency.name, agency_id=str(agency.id))


@app.get("/api/dashboard/overview", response_model=DashboardOverview)
async def dashboard_overview(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    clients_result = await db.execute(select(Client).where(Client.agency_id == agency.id))
    clients = clients_result.scalars().all()
    alerts_result = await db.execute(
        select(func.count()).select_from(Alert)
        .join(Client).where(Client.agency_id == agency.id, Alert.triggered == True)
    )
    return DashboardOverview(
        total_clients=len(clients),
        active_alerts=alerts_result.scalar() or 0,
        total_metrics_today=len(clients) * 5,
        clients=[ClientOut(id=str(c.id), name=c.name, industry=c.industry, channels=c.channels, created_at=c.created_at) for c in clients],
    )


@app.get("/api/clients", response_model=list[ClientOut])
async def list_clients(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    result = await db.execute(select(Client).where(Client.agency_id == agency.id))
    return [ClientOut(id=str(c.id), name=c.name, industry=c.industry, channels=c.channels, created_at=c.created_at) for c in result.scalars().all()]


@app.get("/api/clients/{client_id}/metrics", response_model=list[MetricOut])
async def client_metrics(client_id: str, period: int = 30, channel: str | None = None, db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=period)
    query = select(Metric).where(Metric.client_id == UUID(client_id), Metric.date >= cutoff).order_by(Metric.date)
    if channel:
        query = query.where(Metric.channel == channel)
    result = await db.execute(query)
    return [MetricOut(channel=m.channel, metric_name=m.metric_name, value=m.value, date=m.date) for m in result.scalars().all()]


@app.post("/api/reports/generate", response_model=ReportOut)
async def generate_report(req: ReportRequest, db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    n = datetime.now(timezone.utc)
    client_result = await db.execute(select(Client).where(Client.id == UUID(req.client_id)))
    client = client_result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Cliente no encontrado")
    channels = req.channels or list(client.channels.keys())
    ai_summary = (
        f"Resumen ejecutivo de {client.name} ({client.industry}) - Ultimos {req.period_days} dias:\n\n"
        f"Los canales {', '.join(channels)} muestran una tendencia positiva con crecimiento sostenido. "
        f"Se recomienda aumentar la inversion en los canales con mejor coste por conversion."
    )
    report = Report(client_id=client.id, agency_id=agency.id, title=f"Reporte {client.name} - {n.strftime('%B %Y')}", period_start=n - timedelta(days=req.period_days), period_end=n, ai_summary=ai_summary, channels=channels)
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return ReportOut(id=str(report.id), title=report.title, period_start=report.period_start, period_end=report.period_end, ai_summary=report.ai_summary, channels=report.channels, created_at=report.created_at)


@app.get("/api/reports", response_model=list[ReportOut])
async def list_reports(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    result = await db.execute(select(Report).where(Report.agency_id == agency.id).order_by(Report.created_at.desc()))
    return [ReportOut(id=str(r.id), title=r.title, period_start=r.period_start, period_end=r.period_end, ai_summary=r.ai_summary, channels=r.channels, created_at=r.created_at) for r in result.scalars().all()]


@app.get("/api/alerts", response_model=list[AlertOut])
async def list_alerts(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    result = await db.execute(select(Alert, Client.name).join(Client).where(Client.agency_id == agency.id))
    return [AlertOut(id=str(a.id), client_name=cn, channel=a.channel, metric_name=a.metric_name, threshold=a.threshold, condition=a.condition, triggered=a.triggered) for a, cn in result.all()]


@app.post("/api/ai/chat", response_model=ChatResponse)
async def ai_chat(req: ChatRequest, agency: Agency = Depends(_get_current_agency)):
    if not _check_rate_limit(str(agency.id)):
        raise HTTPException(429, "Limite de peticiones alcanzado (10/hora)")

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--print", "-p", req.message,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd="/app",
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        response_text = stdout.decode("utf-8", errors="replace").strip()
        if not response_text:
            response_text = stderr.decode("utf-8", errors="replace").strip() or "Sin respuesta del asistente"
        return ChatResponse(response=response_text, status="ok")
    except asyncio.TimeoutError:
        return ChatResponse(response="El asistente tardo demasiado en responder. Intenta con una pregunta mas concreta.", status="timeout")
    except FileNotFoundError:
        return ChatResponse(response="El asistente IA no esta disponible en este momento.", status="unavailable")
    except Exception as e:
        return ChatResponse(response=f"Error: {str(e)[:200]}", status="error")


# ---------------------------------------------------------------------------
# Static files (frontend) - MUST be last
# ---------------------------------------------------------------------------

_static_dir = Path("/app/static")
if _static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="frontend")
