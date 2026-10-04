# --- Build Stage ---
FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.9
WORKDIR /app

# 1. Dependency manifests first for optimal Docker layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json turbo.json ./
COPY packages/shared-constants/package.json ./packages/shared-constants/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/

# 2. Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# 3. Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# 4. Generate Prisma client and build packages & API
RUN pnpm --filter forerun-api exec prisma generate
RUN pnpm --filter @forerun/shared-constants build
RUN pnpm --filter @forerun/shared-types build
RUN pnpm --filter forerun-api build

# --- Runtime Stage ---
FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
USER node
COPY --from=builder --chown=node:node /app .
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
