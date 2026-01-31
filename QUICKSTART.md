# 🚀 WhyOps - Quick Start

## TL;DR - Get Running in 2 Minutes

```bash
# 1. Setup and install
./setup.sh

# 2. Start PostgreSQL (if not running)
docker run -d --name whyops-postgres \
  -e POSTGRES_DB=whyops \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine

# 3. Start all services
~/.bun/bin/bun run dev

# Services running:
# - Proxy:   http://localhost:8080
# - Analyse: http://localhost:8081  
# - Auth:    http://localhost:8082
```

## Test It Out

```bash
# Register a user
curl -X POST http://localhost:8082/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","name":"Test User"}'

# Save the JWT token from response
export JWT_TOKEN="your-jwt-token-here"

# Create an OpenAI provider
curl -X POST http://localhost:8082/api/providers \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My OpenAI",
    "type": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-real-openai-key"
  }'

# Save the provider ID from response
export PROVIDER_ID="provider-uuid-here"

# Generate an API key
curl -X POST http://localhost:8082/api/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"providerId":"'$PROVIDER_ID'","name":"Dev Key"}'

# Save the API key from response (starts with whyops_)
export WHYOPS_KEY="whyops_abc123..."

# Make an LLM request through the proxy
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $WHYOPS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role":"user","content":"Hello!"}]
  }'

# View analytics
curl http://localhost:8081/api/analytics/summary
```

## 📚 Full Documentation

- [README.md](./README.md) - Complete setup and usage guide
- [TESTING.md](./TESTING.md) - Testing guide with examples
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture details
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - What was built

## 🐳 Docker (Alternative)

```bash
# Start everything with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 💡 What You Built

A production-ready LLM proxy with:
- ✅ Zero-latency shadow telemetry
- ✅ OpenAI & Anthropic support
- ✅ Streaming responses
- ✅ Complete auth system
- ✅ Event tracking & analytics
- ✅ Decision graph building
- ✅ Rate limiting
- ✅ Production logging

## 🎯 Next Steps

1. Test with real LLM calls
2. Build frontend dashboard
3. Add more providers
4. Deploy to production
5. Set up monitoring

---

**Need help?** Check the docs or open an issue!
