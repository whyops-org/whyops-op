# WhyOps Architecture Documentation

## System Overview

WhyOps is a production-ready LLM observability platform that captures AI cognition through **shadow telemetry** - a non-blocking, zero-latency approach to observability.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Application                       │
│  (OpenAI/Anthropic SDK pointing to WhyOps proxy)                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      whyops-proxy (8080)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Authenticate request (API key)                        │  │
│  │ 2. Apply rate limiting                                   │  │
│  │ 3. Forward to LLM provider (OpenAI/Anthropic)           │  │
│  │ 4. Send telemetry to analyse (non-blocking, parallel)   │  │
│  │ 5. Return response to user                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────┬───────────────────────────────────┬───────────────────┘
          │                                   │
          │ (Forward request)                 │ (Fire-and-forget)
          ▼                                   ▼
┌──────────────────────┐        ┌──────────────────────────────────┐
│  LLM Provider API    │        │   whyops-analyse (8081)          │
│  (OpenAI/Anthropic)  │        │  ┌────────────────────────────┐  │
│                      │        │  │ 1. Receive event data      │  │
│  Returns response    │        │  │ 2. Store in PostgreSQL     │  │
│  directly to proxy   │        │  │ 3. Build decision graphs   │  │
└──────────────────────┘        │  │ 4. Calculate analytics     │  │
                                │  └────────────────────────────┘  │
                                └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      whyops-auth (8082)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ User Management (Register/Login with JWT)                │  │
│  │ Provider Configuration (Store LLM credentials)           │  │
│  │ API Key Generation (For proxy authentication)           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

                         ▲
                         │ (Dashboard uses JWT)
                         │
┌─────────────────────────────────────────────────────────────────┐
│                     Dashboard (Future)                           │
│  React/Next.js UI for managing providers, viewing analytics     │
└─────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Shadow Telemetry (Zero Latency)

**Traditional Proxy:**
```
User → Proxy → LLM → Proxy → User
       (adds latency at each hop)
```

**WhyOps Shadow Telemetry:**
```
User → Proxy → LLM → User (direct path, no wait)
       └─→ Analyse (async, parallel)
```

**Implementation:**
```typescript
// In proxy
const response = await fetch(llmProviderUrl, request); // Main path
sendToAnalyse(eventData).catch(() => {}); // Fire-and-forget
return response; // Immediate return
```

### 2. Production-Safe by Design

- **Fail-Open:** If analyse service is down, proxy continues working
- **No Single Point of Failure:** Analyse service is optional for proxy operation
- **Silent Failures:** Telemetry errors never bubble up to user requests
- **Local Buffering:** Could add queue for failed telemetry (future enhancement)

### 3. Framework-Agnostic

Works with any LLM client library:
- OpenAI SDK (Node, Python, Go, etc.)
- Anthropic SDK
- LangChain
- Custom implementations

Simply change `baseURL` to point to WhyOps proxy.

## Database Schema

### Core Tables

**users**
- User accounts for dashboard
- JWT-based authentication

**providers**
- LLM provider configurations (OpenAI, Anthropic, etc.)
- Stores API keys (encrypted), base URLs
- One user can have multiple providers

**api_keys**
- API keys for proxy authentication
- SHA-256 hashed for security
- Linked to user + provider
- Rate limit per key

**llm_events**
- LLM call telemetry data
- Thread-based tracking
- Decision graph building
- Full request/response capture

**request_logs**
- Request metadata for debugging
- Latency tracking
- Error logging

### Relationships

```
users (1) ──┬─→ (N) providers
            ├─→ (N) api_keys
            └─→ (N) llm_events

providers (1) ─→ (N) api_keys
providers (1) ─→ (N) llm_events

api_keys (1) ─→ (N) request_logs
```

## Request Flow Details

### Authentication Flow

1. User registers → Gets JWT token
2. User creates provider (OpenAI/Anthropic credentials)
3. User generates API key for that provider
4. User configures SDK to use WhyOps proxy with API key

### Proxy Request Flow

1. **Request arrives** at `/v1/chat/completions` or `/v1/messages`
2. **Auth middleware** validates API key
   - Looks up key in database (hashed)
   - Checks if active and not expired
   - Loads associated provider config
3. **Rate limit middleware** checks request count
   - Per-key rate limiting
   - Returns 429 if exceeded
4. **Route handler** processes request
   - Forwards to LLM provider (OpenAI/Anthropic)
   - Handles streaming if requested
   - Sends telemetry to analyse (non-blocking)
   - Returns response to user
5. **Response logged** with latency

### Non-Blocking Telemetry

```typescript
// sendToAnalyse implementation
export async function sendToAnalyse(payload) {
  try {
    // Fire-and-forget fetch with keepalive
    fetch(analyseUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      keepalive: true, // Don't wait for response
    }).catch((error) => {
      // Log but don't throw
      logger.error({ error }, 'Telemetry failed');
    });
  } catch (error) {
    // Never throw - telemetry is optional
    logger.error({ error }, 'Telemetry error');
  }
}
```

## Security Architecture

### API Key Security

1. **Generation:** 
   - Format: `whyops_` + 32 random chars (nanoid)
   - Shown only once on creation
   
2. **Storage:**
   - SHA-256 hash stored in database
   - Original key never stored
   
3. **Validation:**
   - Hash incoming key
   - Lookup hash in database
   - Check active status and expiration

### Provider Credentials

⚠️ **Current (MVP):** Base64 encoding (NOT SECURE)

**Production Recommendation:**
```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag };
}

function decrypt(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

### JWT Authentication

- **Secret:** Configurable via `JWT_SECRET` env var
- **Expiry:** 7 days
- **Payload:** `{ userId, email }`
- **Usage:** Dashboard API authentication

## Scalability Considerations

### Horizontal Scaling

**Proxy Service:**
- ✅ Stateless (can run multiple instances)
- ⚠️ Rate limiting uses in-memory store (use Redis for distributed)
- ✅ No session state

**Analyse Service:**
- ✅ Stateless (can run multiple instances)
- ✅ Database handles concurrency
- ✅ No shared state

**Auth Service:**
- ✅ Stateless (JWT-based auth)
- ✅ Can run multiple instances
- ✅ No session state

### Database Optimization

**Indexes:**
```sql
-- llm_events
CREATE INDEX idx_llm_events_thread_id ON llm_events(thread_id);
CREATE INDEX idx_llm_events_user_id ON llm_events(user_id);
CREATE INDEX idx_llm_events_timestamp ON llm_events(timestamp);
CREATE INDEX idx_llm_events_thread_step ON llm_events(thread_id, step_id);

-- api_keys
CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
```

**Connection Pooling:**
- Min: 5 connections
- Max: 20 connections (configurable)
- Acquire timeout: 30s

### Performance Metrics

**Expected Latency:**
- Proxy overhead: 0-5ms (shadow telemetry)
- Auth lookup: 1-3ms (database index)
- Rate limit check: <1ms (in-memory)
- **Total added latency:** ~1-8ms

**Throughput:**
- Limited by LLM provider rate limits
- Proxy can handle 1000+ req/s per instance
- Database can handle 10,000+ writes/s

## Monitoring & Observability

### Logging

**Structured Logging (Pino):**
```typescript
logger.info({
  method: 'POST',
  path: '/v1/chat/completions',
  statusCode: 200,
  latencyMs: 1243,
  userId: 'uuid',
  model: 'gpt-4',
}, 'Request completed');
```

**Log Levels:**
- `error`: Errors that need attention
- `warn`: Warnings (rate limits, invalid requests)
- `info`: Request/response logging
- `debug`: Detailed debugging info

### Health Checks

Each service exposes:
- `GET /health` - Overall health status
- `GET /health/ready` - Readiness check (includes DB)

### Metrics (Future)

Recommended metrics to track:
- Request count (by provider, model)
- Latency percentiles (p50, p95, p99)
- Error rate
- Token usage
- Cost tracking
- Rate limit hits

**Integration:** Prometheus, Datadog, or CloudWatch

## Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

### Kubernetes (Production)

Example deployment:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whyops-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: whyops-proxy
  template:
    metadata:
      labels:
        app: whyops-proxy
    spec:
      containers:
      - name: proxy
        image: whyops/proxy:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: whyops-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
```

### Environment-Specific Configuration

**Development:**
- Verbose logging (debug level)
- Auto-sync database schema
- CORS enabled for local testing

**Production:**
- Info-level logging
- Manual migrations
- Restricted CORS
- Rate limiting enabled
- Proper encryption for secrets
- Database connection pooling

## Future Enhancements

### Phase 2: Tool Execution Tracking
- Capture tool calls and results
- Track retries and failures
- Sanitization detection

### Phase 3: Memory Retrieval
- RAG pipeline visibility
- Document retrieval tracking
- Similarity score logging

### Phase 4: Planner State
- Agent strategy tracking
- Confidence scores
- Decision branching

### Phase 5: State Replay
- Reproduce production failures
- Time-travel debugging
- Decision graph visualization UI

## Contributing

See main README for development setup.

Key areas for contribution:
- [ ] Proper encryption for provider API keys
- [ ] Redis-based distributed rate limiting
- [ ] More provider integrations (Cohere, Google AI, etc.)
- [ ] Frontend dashboard
- [ ] Metrics/monitoring integration
- [ ] SDK instrumentation layer

## License

MIT
