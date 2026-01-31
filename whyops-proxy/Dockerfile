FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lockb ./
COPY shared/package.json ./shared/
COPY whyops-proxy/package.json ./whyops-proxy/
RUN bun install --frozen-lockfile

# Build stage
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY shared ./shared
COPY whyops-proxy ./whyops-proxy
COPY package.json tsconfig.json ./
RUN bun run build:proxy

# Production stage
FROM base AS production
ENV NODE_ENV=production

COPY --from=install /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/whyops-proxy ./whyops-proxy
COPY package.json ./

EXPOSE 8080

CMD ["bun", "run", "whyops-proxy/src/index.ts"]
