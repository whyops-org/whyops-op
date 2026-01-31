# WhyOps Backend - Production-Ready LLM Proxy Infrastructure

A production-ready, scalable LLM proxy system built with Bun, TypeScript, and PostgreSQL. WhyOps captures LLM cognition through shadow telemetry without blocking requests.

## Architecture

WhyOps consists of three microservices:

### 🚀 whyops-proxy
Ultra-low latency proxy that intercepts LLM requests and forwards them to providers (OpenAI, Anthropic) while sending telemetry data to the analyse service in parallel (non-blocking).

**Port:** 8080  
**Key Features:**
- Zero-latency shadow telemetry
- Streaming support for SSE responses
- Rate limiting & authentication
- OpenAI & Anthropic provider support

### 📊 whyops-analyse
Data persistence service that stores LLM events, builds decision graphs, and provides analytics.

**Port:** 8081  
**Key Features:**
- Event storage (LLM calls, tool executions, etc.)
- Thread tracking and decision graph building
- Analytics and usage statistics
- Non-blocking async data ingestion

### 🔐 whyops-auth
Authentication and provider management service.

**Port:** 8082  
**Key Features:**
- User authentication (JWT)
- Provider configuration (OpenAI/Anthropic credentials)
- API key generation and management
- Dashboard backend

## Quick Start

### Prerequisites
- Bun 1.3+ (will be installed if not present)
- PostgreSQL 16+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone and install dependencies:**
```bash
cd whyops/be
~/.bun/bin/bun install
```

2. **Setup environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start PostgreSQL:**
```bash
docker run -d \
  --name whyops-postgres \
  -e POSTGRES_DB=whyops \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

4. **Run all services:**
```bash
~/.bun/bin/bun run dev
```

Or run individually:
```bash
~/.bun/bin/bun run dev:proxy    # Port 8080
~/.bun/bin/bun run dev:analyse  # Port 8081
~/.bun/bin/bun run dev:auth     # Port 8082
```

### Docker Deployment

```bash
docker-compose up -d
```

## Usage Flow

### 1. Register & Setup Provider

```bash
# Register user
curl -X POST http://localhost:8082/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }'

# Response includes JWT token
# {"user": {...}, "token": "eyJhbGc..."}

# Create OpenAI provider
curl -X POST http://localhost:8082/api/providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My OpenAI",
    "type": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-..."
  }'

# Generate API key for the proxy
curl -X POST http://localhost:8082/api/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "PROVIDER_UUID",
    "name": "Production Key",
    "rateLimit": 100
  }'

# Response includes the API key (save it!)
# {"apiKey": "whyops_abc123...", ...}
```

### 2. Use WhyOps Proxy in Your Code

**OpenAI Example:**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:8080/v1', // WhyOps proxy
  apiKey: 'whyops_abc123...', // WhyOps API key
});

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Request goes to OpenAI
// Telemetry sent to analyse service (non-blocking)
// No latency added to your request!
```

**Anthropic Example:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  baseURL: 'http://localhost:8080/v1', // WhyOps proxy
  apiKey: 'whyops_abc123...', // WhyOps API key
});

const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### 3. View Analytics

```bash
# Get usage statistics
curl http://localhost:8081/api/analytics/usage?userId=USER_UUID

# Get thread details
curl http://localhost:8081/api/threads/THREAD_ID

# Get decision graph
curl http://localhost:8081/api/threads/THREAD_ID/graph
```

## Database Schema

### Tables
- **users** - User accounts
- **providers** - LLM provider configurations (OpenAI, Anthropic)
- **api_keys** - API keys for proxy authentication
- **llm_events** - LLM call events and telemetry data
- **request_logs** - Request logging for debugging

## API Documentation

### whyops-auth (Port 8082)

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires JWT)

#### Providers
- `GET /api/providers` - List providers
- `POST /api/providers` - Create provider
- `GET /api/providers/:id` - Get provider
- `PUT /api/providers/:id` - Update provider
- `DELETE /api/providers/:id` - Delete provider
- `PATCH /api/providers/:id/toggle` - Toggle active status

#### API Keys
- `GET /api/api-keys` - List API keys
- `POST /api/api-keys` - Generate new API key
- `GET /api/api-keys/:id` - Get API key details
- `PUT /api/api-keys/:id` - Update API key
- `DELETE /api/api-keys/:id` - Revoke API key
- `PATCH /api/api-keys/:id/toggle` - Toggle active status

### whyops-proxy (Port 8080)

#### OpenAI Compatible
- `POST /v1/chat/completions` - Chat completions (streaming & non-streaming)
- `GET /v1/models` - List models

#### Anthropic Compatible
- `POST /v1/messages` - Messages API (streaming & non-streaming)

**Authentication:** Bearer token (WhyOps API key)

### whyops-analyse (Port 8081)

#### Events
- `POST /api/events` - Create event (internal use)
- `GET /api/events` - List events
- `GET /api/events/:id` - Get event

#### Threads
- `GET /api/threads` - List threads
- `GET /api/threads/:threadId` - Get thread details
- `GET /api/threads/:threadId/graph` - Get decision graph

#### Analytics
- `GET /api/analytics/usage` - Usage statistics
- `GET /api/analytics/timeline` - Timeline data
- `GET /api/analytics/summary` - Summary metrics

## Production Considerations

### Security
- ✅ JWT authentication for dashboard
- ✅ API key hashing (SHA-256)
- ✅ Rate limiting (configurable)
- ⚠️ Provider API keys use base64 encoding (implement proper encryption for production)
- ✅ CORS enabled

### Performance
- ✅ Non-blocking telemetry (zero latency impact)
- ✅ Connection pooling for PostgreSQL
- ✅ Streaming support for LLM responses
- ✅ In-memory rate limiting (consider Redis for multi-instance)

### Monitoring
- ✅ Structured logging with Pino
- ✅ Health check endpoints
- ✅ Request/response logging
- ✅ Error tracking

### Scalability
- ✅ Horizontal scaling ready (stateless services)
- ✅ Database connection pooling
- ⚠️ Rate limiting uses in-memory store (use Redis for distributed setup)
- ✅ Docker deployment ready

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing (change in production!)
- `PROXY_PORT`, `ANALYSE_PORT`, `AUTH_PORT` - Service ports
- `RATE_LIMIT_MAX_REQUESTS` - Requests per minute
- `LOG_LEVEL` - Logging verbosity

## Development

### Project Structure
```
whyops/be/
├── shared/                 # Shared code (models, types, utils)
│   ├── src/
│   │   ├── config/        # Environment config
│   │   ├── database/      # Sequelize setup
│   │   ├── models/        # Database models
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utilities
│   └── package.json
├── whyops-proxy/          # Proxy service
│   ├── src/
│   │   ├── middleware/    # Auth, rate limiting
│   │   ├── routes/        # OpenAI, Anthropic routes
│   │   └── services/      # Analyse client
│   └── package.json
├── whyops-analyse/        # Analyse service
│   ├── src/
│   │   └── routes/        # Events, threads, analytics
│   └── package.json
├── whyops-auth/           # Auth service
│   ├── src/
│   │   ├── middleware/    # JWT auth
│   │   └── routes/        # Users, providers, API keys
│   └── package.json
├── docker-compose.yml
└── package.json           # Root workspace
```

### Adding New Providers

1. Add provider type to `shared/src/types/index.ts`
2. Create route in `whyops-proxy/src/routes/`
3. Register route in `whyops-proxy/src/index.ts`
4. Update provider schema in auth service

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
