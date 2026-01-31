FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lockb ./
COPY shared/package.json ./shared/
COPY whyops-analyse/package.json ./whyops-analyse/
RUN bun install --frozen-lockfile

# Build stage
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY shared ./shared
COPY whyops-analyse ./whyops-analyse
COPY package.json tsconfig.json ./
RUN bun run build:analyse

# Production stage
FROM base AS production
ENV NODE_ENV=production

COPY --from=install /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/whyops-analyse ./whyops-analyse
COPY package.json ./

EXPOSE 8081

CMD ["bun", "run", "whyops-analyse/src/index.ts"]
