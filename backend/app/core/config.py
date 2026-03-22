import os

def _resolve_database_url() -> str:
    """Resolve database URL, handling Dokku postgres plugin format."""
    # Dokku postgres plugin sets DATABASE_URL as postgres://...
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        return "postgresql+asyncpg://app:changeme@localhost:5432/agencyreport"
    # Convert postgres:// or postgresql:// to postgresql+asyncpg://
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix):]
    return url

DATABASE_URL = _resolve_database_url()
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week
ALGORITHM = "HS256"
