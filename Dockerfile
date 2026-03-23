# Stage 1: Build Next.js frontend (standalone mode)
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
ENV API_URL=http://localhost:8000
RUN npm run build

# Stage 2: Runtime with Python backend + Node frontend
FROM python:3.12-slim
WORKDIR /app

# Install Node.js for Next.js standalone server
RUN apt-get update -qq && apt-get install -y -qq curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y -qq nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install SSH client (for calling Claude/Codex on HOST)
RUN apt-get update -qq && apt-get install -y -qq openssh-client && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Python backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app/ app/

# Next.js standalone build
COPY --from=frontend /build/.next/standalone /app/frontend/
COPY --from=frontend /build/.next/static /app/frontend/.next/static/

# Create non-root user
RUN useradd -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app

# Start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

USER appuser
EXPOSE 8000 3000
CMD ["/app/start.sh"]
