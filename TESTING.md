# WhyOps Testing Guide

## Quick Start Testing

### 1. Start the Services

**Option A: All services at once**
```bash
bun run dev
```

**Option B: Individual services**
```bash
# Terminal 1
bun run dev:proxy

# Terminal 2
bun run dev:analyse

# Terminal 3
bun run dev:auth
```

### 2. Register a User

```bash
curl -X POST http://localhost:8082/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@whyops.com",
    "password": "testpassword123",
    "name": "Test User"
  }'
```

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@whyops.com",
    "name": "Test User"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the JWT token!**

### 3. Create a Provider

```bash
export JWT_TOKEN="your-jwt-token-from-step-2"

# For OpenAI
curl -X POST http://localhost:8082/api/providers \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My OpenAI Provider",
    "type": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-real-openai-key"
  }'

# OR for Anthropic
curl -X POST http://localhost:8082/api/providers \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Anthropic Provider",
    "type": "anthropic",
    "baseUrl": "https://api.anthropic.com/v1",
    "apiKey": "sk-ant-your-real-anthropic-key"
  }'
```

**Response:**
```json
{
  "id": "provider-uuid-here",
  "name": "My OpenAI Provider",
  "type": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "isActive": true,
  "createdAt": "2026-01-30T..."
}
```

**Save the provider ID!**

### 4. Generate an API Key

```bash
export PROVIDER_ID="provider-uuid-from-step-3"

curl -X POST http://localhost:8082/api/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "'$PROVIDER_ID'",
    "name": "Development Key",
    "rateLimit": 100
  }'
```

**Response:**
```json
{
  "id": "api-key-uuid",
  "name": "Development Key",
  "apiKey": "whyops_abc123xyz456...",
  "keyPrefix": "whyops_abc1",
  "providerId": "provider-uuid",
  "rateLimit": 100,
  "isActive": true,
  "createdAt": "2026-01-30T...",
  "warning": "Save this API key securely. You will not be able to retrieve it again."
}
```

**⚠️ SAVE THE API KEY! You cannot retrieve it again!**

### 5. Test the Proxy

```bash
export WHYOPS_API_KEY="whyops_abc123xyz456..."

# Test OpenAI
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $WHYOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello! This is a test."}
    ]
  }'

# OR Test Anthropic
curl -X POST http://localhost:8080/v1/messages \
  -H "Authorization: Bearer $WHYOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-haiku-20240307",
    "max_tokens": 100,
    "messages": [
      {"role": "user", "content": "Hello! This is a test."}
    ]
  }'
```

### 6. View the Logged Data

```bash
# Get all events
curl http://localhost:8081/api/events

# Get threads
curl http://localhost:8081/api/threads

# Get specific thread
curl http://localhost:8081/api/threads/thread_abc123

# Get usage analytics
curl http://localhost:8081/api/analytics/usage

# Get summary
curl http://localhost:8081/api/analytics/summary
```

## Integration Testing with SDK

### OpenAI SDK Example

Create `test-openai.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'whyops_your-api-key-here', // WhyOps API key
});

async function main() {
  console.log('Testing WhyOps Proxy with OpenAI...');
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' }
    ],
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('✅ Request successful! Check analyse service for logged data.');
}

main();
```

Run:
```bash
bun run test-openai.ts
```

### Anthropic SDK Example

Create `test-anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'whyops_your-api-key-here', // WhyOps API key
});

async function main() {
  console.log('Testing WhyOps Proxy with Anthropic...');
  
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],
  });

  console.log('Response:', response.content[0].text);
  console.log('✅ Request successful! Check analyse service for logged data.');
}

main();
```

Run:
```bash
bun install @anthropic-ai/sdk
bun run test-anthropic.ts
```

### Streaming Example

Create `test-streaming.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'whyops_your-api-key-here',
});

async function main() {
  console.log('Testing streaming...');
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Count from 1 to 5' }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
  
  console.log('\n✅ Streaming successful!');
}

main();
```

## Health Checks

```bash
# Check proxy health
curl http://localhost:8080/health

# Check analyse health
curl http://localhost:8081/health

# Check auth health
curl http://localhost:8082/health
```

## Performance Testing

### Measure Latency Impact

```bash
# Direct to OpenAI (baseline)
time curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-openai-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Through WhyOps proxy
time curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer whyops_your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected:** ~0-5ms difference (shadow telemetry is non-blocking)

## Troubleshooting

### "Unauthorized" Error
- Check that you're using the WhyOps API key (not your OpenAI/Anthropic key)
- Verify the API key is active: `curl http://localhost:8082/api/api-keys -H "Authorization: Bearer $JWT_TOKEN"`

### "Provider not found"
- Ensure the provider is created and active
- Check provider configuration is correct

### No data in analyse service
- Check analyse service logs
- Verify ANALYSE_URL in proxy .env is correct
- Check network connectivity between services

### Rate limit errors
- Adjust RATE_LIMIT_MAX_REQUESTS in .env
- Check current rate limit status in response headers

## Next Steps

1. Build a frontend dashboard
2. Add more providers (Cohere, Google AI, etc.)
3. Implement Redis for distributed rate limiting
4. Add proper encryption for provider API keys
5. Set up monitoring and alerting
6. Create user documentation
