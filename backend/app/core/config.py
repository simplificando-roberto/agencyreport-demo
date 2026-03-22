import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://app:changeme@localhost:5432/agencyreport"
)
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week
ALGORITHM = "HS256"
