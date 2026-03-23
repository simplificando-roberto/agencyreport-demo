import os
import secrets

def _resolve_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        return "postgresql+asyncpg://app:changeme@localhost:5432/agencyreport"
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix):]
    return url

DATABASE_URL = _resolve_database_url()

# JWT secret: required in prod, auto-generated in dev
SECRET_KEY = os.environ.get("SECRET_KEY", "")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(32)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours (was 7 days)

# Cookie config
COOKIE_NAME = "ar_token"
COOKIE_SECURE = True
COOKIE_HTTPONLY = True
COOKIE_SAMESITE = "strict"
