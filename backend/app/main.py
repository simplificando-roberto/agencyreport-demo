"""AgencyReport v3 - Reporting automatizado con Asistente IA y Excel/PDF."""

import asyncio
import csv
import hashlib
import io
import json
import logging
import os
import secrets
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import time as now
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.database import Base, engine, get_db, SessionLocal
from app.models import Agency, Client, Metric, Alert, Report
from app.services.mock_data import DEMO_CLIENTS, generate_metrics

log = logging.getLogger("agencyreport")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_AI = 10

def _check_rate_limit(key: str) -> tuple[bool, int]:
    cutoff = now() - 3600
    _rate_limits[key] = [t for t in _rate_limits[key] if t > cutoff]
    remaining = RATE_LIMIT_AI - len(_rate_limits[key])
    if remaining <= 0:
        return False, 0
    _rate_limits[key].append(now())
    return True, remaining - 1

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

async def _get_clients_summary(db: AsyncSession, agency_id) -> list[dict]:
    """Get summary of all clients with latest metrics for AI context."""
    clients_r = await db.execute(select(Client).where(Client.agency_id == agency_id))
    clients = clients_r.scalars().all()
    result = []
    cutoff = datetime.utcnow() - timedelta(days=30)
    for c in clients:
        metrics_r = await db.execute(
            select(Metric).where(Metric.client_id == c.id, Metric.date >= cutoff)
            .order_by(Metric.date.desc()).limit(50)
        )
        metrics = metrics_r.scalars().all()
        summary = {}
        for m in metrics:
            key = f"{m.channel}/{m.metric_name}"
            if key not in summary:
                summary[key] = {"latest": m.value, "channel": m.channel, "metric": m.metric_name}
        result.append({
            "name": c.name, "industry": c.industry,
            "channels": list(c.channels.keys()),
            "metrics_last_30d": list(summary.values())[:15],
        })
    return result

# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def _seed_demo(db: AsyncSession):
    result = await db.execute(select(func.count()).select_from(Agency))
    if result.scalar():
        return
    admin_pw = os.environ.get("ADMIN_PASSWORD", "") or secrets.token_urlsafe(12)
    log.warning("Admin creado: email=admin@agency.test password=%s", admin_pw)
    agency = Agency(name="Demo Agency", email="admin@agency.test", password_hash=_hash_password(admin_pw), brand_color="#2563eb")
    db.add(agency)
    await db.flush()
    for i, cd in enumerate(DEMO_CLIENTS):
        client = Client(agency_id=agency.id, name=cd["name"], industry=cd["industry"], channels=cd["channels"])
        db.add(client)
        await db.flush()
        for m in generate_metrics(cd["channels"], days=90, client_index=i):
            db.add(Metric(client_id=client.id, **m))
        # One client with triggered alert
        ch = next(iter(cd["channels"]))
        db.add(Alert(client_id=client.id, channel=ch, metric_name="engagement_rate" if "instagram" in cd["channels"] else "clicks", threshold=2.0, condition="below", triggered=(i == 2)))
    await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await _seed_demo(db)
    yield

app = FastAPI(title="AgencyReport", version="0.3.0", lifespan=lifespan)
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
    recent_alerts: list[dict]

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
    client_id: str | None = None

class ChatResponse(BaseModel):
    response: str
    status: str
    remaining_requests: int

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def _create_token(agency_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": agency_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

async def _get_current_agency(request: Request, db: AsyncSession = Depends(get_db)) -> Agency:
    auth = request.headers.get("Authorization", "")
    # Also accept token as query param (for file downloads via window.open)
    if not auth.startswith("Bearer "):
        token_param = request.query_params.get("token", "")
        if token_param:
            auth = f"Bearer {token_param}"
        else:
            raise HTTPException(401, "Token requerido")
    try:
        payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
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
# Auth endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "agencyreport", "version": "0.3.0"}

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agency).where(Agency.email == req.email))
    agency = result.scalar_one_or_none()
    if not agency or agency.password_hash != _hash_password(req.password):
        raise HTTPException(401, "Credenciales invalidas")
    return TokenResponse(access_token=_create_token(str(agency.id)), agency_name=agency.name, agency_id=str(agency.id))

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@app.get("/api/dashboard/overview", response_model=DashboardOverview)
async def dashboard_overview(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    clients_r = await db.execute(select(Client).where(Client.agency_id == agency.id))
    clients = clients_r.scalars().all()
    alerts_r = await db.execute(select(func.count()).select_from(Alert).join(Client).where(Client.agency_id == agency.id, Alert.triggered == True))
    # Recent triggered alerts
    recent_r = await db.execute(
        select(Alert, Client.name).join(Client)
        .where(Client.agency_id == agency.id, Alert.triggered == True)
        .order_by(Alert.created_at.desc()).limit(3)
    )
    recent_alerts = [{"client": cn, "channel": a.channel, "metric": a.metric_name, "threshold": a.threshold} for a, cn in recent_r.all()]
    return DashboardOverview(
        total_clients=len(clients), active_alerts=alerts_r.scalar() or 0, total_metrics_today=len(clients) * 5,
        clients=[ClientOut(id=str(c.id), name=c.name, industry=c.industry, channels=c.channels, created_at=c.created_at) for c in clients],
        recent_alerts=recent_alerts,
    )

# ---------------------------------------------------------------------------
# Clients & Metrics
# ---------------------------------------------------------------------------
@app.get("/api/clients", response_model=list[ClientOut])
async def list_clients(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    result = await db.execute(select(Client).where(Client.agency_id == agency.id))
    return [ClientOut(id=str(c.id), name=c.name, industry=c.industry, channels=c.channels, created_at=c.created_at) for c in result.scalars().all()]

@app.get("/api/clients/{client_id}/metrics", response_model=list[MetricOut])
async def client_metrics(client_id: str, period: int = 30, channel: str | None = None, db: AsyncSession = Depends(get_db), _agency: Agency = Depends(_get_current_agency)):
    cutoff = datetime.utcnow() - timedelta(days=period)
    query = select(Metric).where(Metric.client_id == UUID(client_id), Metric.date >= cutoff).order_by(Metric.date)
    if channel:
        query = query.where(Metric.channel == channel)
    result = await db.execute(query)
    return [MetricOut(channel=m.channel, metric_name=m.metric_name, value=m.value, date=m.date) for m in result.scalars().all()]

@app.get("/api/clients/{client_id}/metrics/csv")
async def export_metrics_csv(client_id: str, period: int = 90, db: AsyncSession = Depends(get_db), _agency: Agency = Depends(_get_current_agency)):
    cutoff = datetime.utcnow() - timedelta(days=period)
    result = await db.execute(select(Metric).where(Metric.client_id == UUID(client_id), Metric.date >= cutoff).order_by(Metric.date))
    metrics = result.scalars().all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["fecha", "canal", "metrica", "valor"])
    for m in metrics:
        writer.writerow([m.date.strftime("%Y-%m-%d"), m.channel, m.metric_name, m.value])
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode("utf-8-sig")), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=metricas_{client_id[:8]}.csv"})

# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
@app.post("/api/reports/generate", response_model=ReportOut)
async def generate_report(req: ReportRequest, db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    n = datetime.utcnow()
    client_r = await db.execute(select(Client).where(Client.id == UUID(req.client_id)))
    client = client_r.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Cliente no encontrado")
    channels = req.channels or list(client.channels.keys())
    ai_summary = (f"Resumen ejecutivo de {client.name} ({client.industry}) - Ultimos {req.period_days} dias:\n\n"
                  f"Los canales {', '.join(channels)} muestran una tendencia positiva con crecimiento sostenido. "
                  f"Se recomienda aumentar la inversion en los canales con mejor coste por conversion.")
    report = Report(client_id=client.id, agency_id=agency.id, title=f"Reporte {client.name} - {n.strftime('%B %Y')}", period_start=n - timedelta(days=req.period_days), period_end=n, ai_summary=ai_summary, channels=channels)
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return ReportOut(id=str(report.id), title=report.title, period_start=report.period_start, period_end=report.period_end, ai_summary=report.ai_summary, channels=report.channels, created_at=report.created_at)

@app.get("/api/reports", response_model=list[ReportOut])
async def list_reports(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    result = await db.execute(select(Report).where(Report.agency_id == agency.id).order_by(Report.created_at.desc()))
    return [ReportOut(id=str(r.id), title=r.title, period_start=r.period_start, period_end=r.period_end, ai_summary=r.ai_summary, channels=r.channels, created_at=r.created_at) for r in result.scalars().all()]

@app.get("/api/reports/{report_id}/excel")
async def download_report_excel(report_id: str, db: AsyncSession = Depends(get_db), _agency: Agency = Depends(_get_current_agency)):
    from openpyxl import Workbook
    report_r = await db.execute(select(Report).where(Report.id == UUID(report_id)))
    report = report_r.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Reporte no encontrado")
    metrics_r = await db.execute(select(Metric).where(Metric.client_id == report.client_id, Metric.date >= report.period_start, Metric.date <= report.period_end).order_by(Metric.date))
    metrics = metrics_r.scalars().all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Metricas"
    ws.append(["Fecha", "Canal", "Metrica", "Valor"])
    for m in metrics:
        ws.append([m.date.strftime("%Y-%m-%d"), m.channel, m.metric_name, m.value])
    # Summary sheet
    ws2 = wb.create_sheet("Resumen")
    ws2.append(["Reporte", report.title])
    ws2.append(["Periodo", f"{report.period_start.strftime('%Y-%m-%d')} a {report.period_end.strftime('%Y-%m-%d')}"])
    ws2.append(["Canales", ", ".join(report.channels)])
    ws2.append([])
    ws2.append(["Resumen IA"])
    ws2.append([report.ai_summary or ""])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=reporte_{report_id[:8]}.xlsx"})

@app.post("/api/data/upload")
async def upload_data(client_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), _agency: Agency = Depends(_get_current_agency)):
    """Upload Excel/CSV with metrics data. Expected columns: fecha, canal, metrica, valor"""
    content = await file.read()
    rows_imported = 0
    if file.filename and file.filename.endswith((".xlsx", ".xls")):
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(content))
        ws = wb.active
        headers = [str(c.value or "").lower().strip() for c in ws[1]]
        for row in ws.iter_rows(min_row=2, values_only=True):
            data = dict(zip(headers, row))
            if not data.get("fecha") or not data.get("valor"):
                continue
            date_val = data["fecha"] if isinstance(data["fecha"], datetime) else datetime.strptime(str(data["fecha"])[:10], "%Y-%m-%d")
            db.add(Metric(client_id=UUID(client_id), channel=str(data.get("canal", "manual")), metric_name=str(data.get("metrica", "valor")), value=float(data["valor"]), date=date_val))
            rows_imported += 1
    else:  # CSV
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            date_str = row.get("fecha", "") or row.get("date", "")
            value_str = row.get("valor", "") or row.get("value", "")
            if not date_str or not value_str:
                continue
            db.add(Metric(client_id=UUID(client_id), channel=row.get("canal", "") or row.get("channel", "manual"), metric_name=row.get("metrica", "") or row.get("metric", "valor"), value=float(value_str), date=datetime.strptime(date_str[:10], "%Y-%m-%d")))
            rows_imported += 1
    await db.commit()
    return {"status": "ok", "rows_imported": rows_imported}

# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
@app.get("/api/alerts", response_model=list[AlertOut])
async def list_alerts(db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    result = await db.execute(select(Alert, Client.name).join(Client).where(Client.agency_id == agency.id))
    return [AlertOut(id=str(a.id), client_name=cn, channel=a.channel, metric_name=a.metric_name, threshold=a.threshold, condition=a.condition, triggered=a.triggered) for a, cn in result.all()]

# ---------------------------------------------------------------------------
# AI Chat
# ---------------------------------------------------------------------------
@app.get("/api/ai/suggestions")
async def ai_suggestions(client_id: str | None = None):
    base = [
        "Como ha sido el rendimiento general este mes?",
        "Que canal tiene mejor ROI?",
        "Genera un resumen ejecutivo para enviar al cliente",
        "Que mejoras recomiendas para las campanas?",
    ]
    if client_id:
        return {"suggestions": base + ["Compara el ultimo mes con el anterior", "Que metricas estan por debajo del objetivo?"]}
    return {"suggestions": base}


# ---------------------------------------------------------------------------
# AI Setup (login/config)
# ---------------------------------------------------------------------------

# Persistent config on disk
_AI_CONFIG_PATH = Path("/app/config/ai_config.json") if Path("/app/config").is_dir() else Path("/app/ai_config.json")
_login_processes: dict[str, asyncio.subprocess.Process] = {}

def _load_ai_config() -> dict:
    if _AI_CONFIG_PATH.exists():
        return json.loads(_AI_CONFIG_PATH.read_text())
    return {"default_provider": "claude"}

def _save_ai_config(cfg: dict):
    _AI_CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


async def _check_cli_status(cli: str) -> dict:
    """Check if a CLI is installed and authenticated."""
    result = {"installed": False, "authenticated": False, "version": ""}
    try:
        proc = await asyncio.create_subprocess_exec(
            cli, "--version", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        if proc.returncode == 0:
            result["installed"] = True
            result["version"] = stdout.decode().strip()
    except (FileNotFoundError, asyncio.TimeoutError):
        return result

    # Check auth
    try:
        if cli == "claude":
            proc = await asyncio.create_subprocess_exec(
                "claude", "auth", "status", "--json",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            data = json.loads(stdout.decode())
            result["authenticated"] = data.get("loggedIn", False)
        elif cli == "codex":
            proc = await asyncio.create_subprocess_exec(
                "codex", "login", "status",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            result["authenticated"] = proc.returncode == 0 and "logged in" in stdout.decode().lower()
    except Exception:
        pass
    return result


@app.get("/api/ai/setup/status")
async def ai_setup_status(_agency: Agency = Depends(_get_current_agency)):
    """Get status of all AI providers."""
    claude_status = await _check_cli_status("claude")
    codex_status = await _check_cli_status("codex")
    config = _load_ai_config()
    return {
        "default_provider": config.get("default_provider", "claude"),
        "providers": {
            "claude": {**claude_status, "name": "Claude Code", "login_method": "OAuth (abre URL en navegador)"},
            "codex": {**codex_status, "name": "Codex (OpenAI)", "login_method": "Device auth (codigo + URL)"},
        },
    }


@app.post("/api/ai/setup/login")
async def ai_setup_login(provider: str = "claude", _agency: Agency = Depends(_get_current_agency)):
    """Start login process for a provider. Returns URL/code for the user to complete."""
    if provider in _login_processes:
        # Kill any existing login process
        try:
            _login_processes[provider].kill()
        except Exception:
            pass
        del _login_processes[provider]

    try:
        if provider == "claude":
            proc = await asyncio.create_subprocess_exec(
                "claude", "auth", "login", "--claudeai",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE)
        elif provider == "codex":
            proc = await asyncio.create_subprocess_exec(
                "codex", "login", "--device-auth",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE)
        else:
            raise HTTPException(400, f"Proveedor desconocido: {provider}")

        _login_processes[provider] = proc

        # Read output for ~10 seconds to capture the URL/code
        output_lines = []
        try:
            for _ in range(20):
                await asyncio.sleep(0.5)
                if proc.stdout and proc.stdout._buffer:  # type: ignore
                    data = await asyncio.wait_for(proc.stdout.read(4096), timeout=1)
                    if data:
                        output_lines.append(data.decode("utf-8", errors="replace"))
                if proc.stderr and proc.stderr._buffer:  # type: ignore
                    data = await asyncio.wait_for(proc.stderr.read(4096), timeout=1)
                    if data:
                        output_lines.append(data.decode("utf-8", errors="replace"))
                if proc.returncode is not None:
                    break
        except (asyncio.TimeoutError, Exception):
            pass

        full_output = "\n".join(output_lines)

        # Extract URL from output
        import re
        urls = re.findall(r'https?://[^\s\)\"\']+', full_output)
        login_url = urls[0] if urls else ""

        # Extract device code if present
        codes = re.findall(r'code[:\s]+([A-Z0-9-]{4,})', full_output, re.IGNORECASE)
        device_code = codes[0] if codes else ""

        return {
            "status": "login_started",
            "provider": provider,
            "login_url": login_url,
            "device_code": device_code,
            "raw_output": full_output,
            "instructions": (
                f"Abre la URL en tu navegador para autorizar {provider}. "
                f"Una vez autorizado, vuelve aqui y pulsa 'Verificar'."
            ),
        }
    except FileNotFoundError:
        raise HTTPException(400, f"{provider} CLI no esta instalado en el servidor")


@app.post("/api/ai/setup/verify")
async def ai_setup_verify(provider: str = "claude", _agency: Agency = Depends(_get_current_agency)):
    """Check if login completed successfully."""
    status = await _check_cli_status(provider)
    if provider in _login_processes:
        try:
            _login_processes[provider].kill()
        except Exception:
            pass
        del _login_processes[provider]
    return {"provider": provider, "authenticated": status["authenticated"], "version": status["version"]}


@app.post("/api/ai/setup/default")
async def ai_setup_set_default(provider: str = "claude", _agency: Agency = Depends(_get_current_agency)):
    """Set the default AI provider."""
    config = _load_ai_config()
    config["default_provider"] = provider
    _save_ai_config(config)
    return {"default_provider": provider}


@app.post("/api/ai/setup/logout")
async def ai_setup_logout(provider: str = "claude", _agency: Agency = Depends(_get_current_agency)):
    """Logout from a provider (removes credentials from server)."""
    try:
        if provider == "claude":
            proc = await asyncio.create_subprocess_exec("claude", "auth", "logout", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        elif provider == "codex":
            proc = await asyncio.create_subprocess_exec("codex", "login", "--with-api-key", stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            proc.stdin.write(b"\n")  # Empty key = logout
            proc.stdin.close()
        else:
            raise HTTPException(400, f"Proveedor desconocido: {provider}")
        await asyncio.wait_for(proc.communicate(), timeout=10)
    except Exception:
        pass
    return {"status": "logged_out", "provider": provider}


# ---------------------------------------------------------------------------
# Update AI chat to use configured provider
# ---------------------------------------------------------------------------

# Patch the existing ai_chat endpoint to read default_provider
@app.post("/api/ai/chat", response_model=ChatResponse)
async def ai_chat_v2(req: ChatRequest, db: AsyncSession = Depends(get_db), agency: Agency = Depends(_get_current_agency)):
    # Override the provider based on config
    config = _load_ai_config()
    provider = config.get("default_provider", "claude")

    allowed, remaining = _check_rate_limit(str(agency.id))
    if not allowed:
        raise HTTPException(429, "Limite de peticiones alcanzado (10/hora)")

    # Build context
    if req.client_id:
        client_r = await db.execute(select(Client).where(Client.id == UUID(req.client_id)))
        client = client_r.scalar_one_or_none()
        cutoff = datetime.utcnow() - timedelta(days=30)
        metrics_r = await db.execute(select(Metric).where(Metric.client_id == UUID(req.client_id), Metric.date >= cutoff).order_by(Metric.date.desc()).limit(30))
        metrics = metrics_r.scalars().all()
        context = f"Cliente: {client.name} ({client.industry})\nCanales: {', '.join(client.channels.keys())}\nMetricas ultimos 30 dias:\n"
        for m in metrics[:20]:
            context += f"  {m.date.strftime('%d/%m')}: {m.channel}/{m.metric_name} = {m.value:.1f}\n"
    else:
        clients_summary = await _get_clients_summary(db, agency.id)
        context = f"Agencia: {agency.name}\nClientes:\n{json.dumps(clients_summary, indent=2, ensure_ascii=False)}"

    system_prompt = f"""Eres el asistente IA de AgencyReport para la agencia "{agency.name}".
Tienes acceso a datos reales de metricas de marketing digital.
Responde siempre en espanol. Se conciso y practico.
Usa datos concretos en tus respuestas cuando los tengas.

DATOS DISPONIBLES:
{context}"""

    try:
        if provider == "claude":
            cmd = ["claude", "--print", "-p", f"[System: {system_prompt}]\n\nUsuario: {req.message}"]
        elif provider == "codex":
            cmd = ["codex", "exec", "--dangerously-bypass-approvals-and-sandbox", f"{system_prompt}\n\n{req.message}"]
        else:
            return ChatResponse(response=f"Proveedor '{provider}' no configurado", status="error", remaining_requests=remaining)

        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd="/app")
        stdout_data, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
        response_text = stdout_data.decode("utf-8", errors="replace").strip()
        if not response_text:
            response_text = "No pude generar una respuesta. Verifica que el proveedor este autenticado en Configuracion."
        return ChatResponse(response=response_text, status="ok", remaining_requests=remaining)
    except asyncio.TimeoutError:
        return ChatResponse(response="El asistente tardo demasiado.", status="timeout", remaining_requests=remaining)
    except FileNotFoundError:
        return ChatResponse(response=f"{provider} no esta instalado. Ve a Chat IA > Configuracion para verificar.", status="unavailable", remaining_requests=remaining)
    except Exception as e:
        return ChatResponse(response=f"Error: {str(e)[:200]}", status="error", remaining_requests=remaining)



# ---------------------------------------------------------------------------
# Static files (frontend) - MUST be last
# ---------------------------------------------------------------------------
_static_dir = Path("/app/static")
if _static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="frontend")
