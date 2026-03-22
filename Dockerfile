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

# Install AI CLIs (claude code + codex) inside container
RUN npm install -g @openai/codex@latest 2>/dev/null || true

# Python backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app/ app/

# Next.js standalone build
COPY --from=frontend /build/.next/standalone /app/frontend/
COPY --from=frontend /build/.next/static /app/frontend/.next/static/

# Start script: both backend and frontend
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8000 3000
CMD ["/app/start.sh"]
