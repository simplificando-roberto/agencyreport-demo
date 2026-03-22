"""AgencyReport - Reporting automatizado para agencias de marketing."""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import hashlib
from jose import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.database import Base, engine, get_db
from app.models import Agency, Client, Metric, Alert, Report
from app.services.mock_data import DEMO_CLIENTS, generate_metrics


# --- Lifespan: create tables + seed demo data ---

async def _seed_demo(db: AsyncSession):
    """Seed demo agency + 3 clients with mock metrics if DB is empty."""
    result = await db.execute(select(func.count()).select_from(Agency))
    if result.scalar():
        return  # already seeded

    agency = Agency(
        name="Demo Agency",
        email="demo@agency.test",
        password_hash=hashlib.sha256(b"demo1234").hexdigest(),
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

        metrics = generate_metrics(client_data["channels"], days=90)
        for m in metrics:
            db.add(Metric(client_id=client.id, **m))

        # Add a sample alert
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
    from app.core.database import SessionLocal
    async with SessionLocal() as db:
        await _seed_demo(db)
    yield


app = FastAPI(title="AgencyReport", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Schemas ---

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


# --- Auth helpers ---

def _create_token(agency_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": agency_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def _get_current_agency(db: AsyncSession = Depends(get_db)) -> Agency:
    """For demo, always return the first agency (no real auth check)."""
    result = await db.execute(select(Agency).limit(1))
    agency = result.scalar_one_or_none()
    if not agency:
        raise HTTPException(401, "No agency found")
    return agency


# --- Endpoints ---

@app.get("/health")
async def health():
    return {"status": "ok", "service": "agencyreport"}


@app.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agency).where(Agency.email == req.email))
    agency = result.scalar_one_or_none()
    if not agency or agency.password_hash != hashlib.sha256(req.password.encode()).hexdigest():
        raise HTTPException(401, "Credenciales invalidas")
    token = _create_token(str(agency.id))
    return TokenResponse(access_token=token, agency_name=agency.name, agency_id=str(agency.id))


@app.get("/dashboard/overview", response_model=DashboardOverview)
async def dashboard_overview(
    db: AsyncSession = Depends(get_db),
    agency: Agency = Depends(_get_current_agency),
):
    clients_result = await db.execute(
        select(Client).where(Client.agency_id == agency.id)
    )
    clients = clients_result.scalars().all()

    alerts_result = await db.execute(
        select(func.count()).select_from(Alert)
        .join(Client).where(Client.agency_id == agency.id, Alert.triggered == True)
    )
    active_alerts = alerts_result.scalar() or 0

    return DashboardOverview(
        total_clients=len(clients),
        active_alerts=active_alerts,
        total_metrics_today=len(clients) * 5,
        clients=[
            ClientOut(
                id=str(c.id), name=c.name, industry=c.industry,
                channels=c.channels, created_at=c.created_at,
            ) for c in clients
        ],
    )


@app.get("/clients", response_model=list[ClientOut])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    agency: Agency = Depends(_get_current_agency),
):
    result = await db.execute(select(Client).where(Client.agency_id == agency.id))
    return [
        ClientOut(id=str(c.id), name=c.name, industry=c.industry,
                  channels=c.channels, created_at=c.created_at)
        for c in result.scalars().all()
    ]


@app.get("/clients/{client_id}/metrics", response_model=list[MetricOut])
async def client_metrics(
    client_id: str,
    period: int = 30,
    channel: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=period)
    query = select(Metric).where(
        Metric.client_id == UUID(client_id),
        Metric.date >= cutoff,
    ).order_by(Metric.date)
    if channel:
        query = query.where(Metric.channel == channel)
    result = await db.execute(query)
    return [
        MetricOut(channel=m.channel, metric_name=m.metric_name, value=m.value, date=m.date)
        for m in result.scalars().all()
    ]


@app.post("/reports/generate", response_model=ReportOut)
async def generate_report(
    req: ReportRequest,
    db: AsyncSession = Depends(get_db),
    agency: Agency = Depends(_get_current_agency),
):
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=req.period_days)

    # Fetch client
    client_result = await db.execute(select(Client).where(Client.id == UUID(req.client_id)))
    client = client_result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Cliente no encontrado")

    channels = req.channels or list(client.channels.keys())

    # Generate AI summary (mock for now)
    ai_summary = (
        f"Resumen ejecutivo de {client.name} ({client.industry}) - "
        f"Ultimos {req.period_days} dias:\n\n"
        f"Los canales {', '.join(channels)} muestran una tendencia positiva "
        f"con crecimiento sostenido en las metricas principales. "
        f"Se recomienda aumentar la inversion en los canales con mejor "
        f"coste por conversion y mantener la estrategia de contenido actual."
    )

    report = Report(
        client_id=client.id,
        agency_id=agency.id,
        title=f"Reporte {client.name} - {now.strftime('%B %Y')}",
        period_start=period_start,
        period_end=now,
        ai_summary=ai_summary,
        channels=channels,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return ReportOut(
        id=str(report.id), title=report.title,
        period_start=report.period_start, period_end=report.period_end,
        ai_summary=report.ai_summary, channels=report.channels,
        created_at=report.created_at,
    )


@app.get("/reports", response_model=list[ReportOut])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    agency: Agency = Depends(_get_current_agency),
):
    result = await db.execute(
        select(Report).where(Report.agency_id == agency.id).order_by(Report.created_at.desc())
    )
    return [
        ReportOut(
            id=str(r.id), title=r.title,
            period_start=r.period_start, period_end=r.period_end,
            ai_summary=r.ai_summary, channels=r.channels,
            created_at=r.created_at,
        ) for r in result.scalars().all()
    ]


@app.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    agency: Agency = Depends(_get_current_agency),
):
    result = await db.execute(
        select(Alert, Client.name)
        .join(Client).where(Client.agency_id == agency.id)
    )
    return [
        AlertOut(
            id=str(alert.id), client_name=client_name,
            channel=alert.channel, metric_name=alert.metric_name,
            threshold=alert.threshold, condition=alert.condition,
            triggered=alert.triggered,
        ) for alert, client_name in result.all()
    ]
