# AI Infra - OpenAI Compatible API for Gening AI

## Overview
OpenAI-compatible API that proxies requests to Gening AI endpoints with automatic UID/Ticket management.

## API Usage

### Endpoint
```
POST /v1/chat/completions
```

### Request
```json
{
  "model": "geningai/gpt3",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
```

### Available Models
| Model | Streaming | Description |
|-------|-----------|-------------|
| `geningai/gpt3` | ❌ No | GPT-3 (general chat) |
| `geningai/llama-roleplay` | ✅ Yes | LLaMA (character chat) |

### Response (Non-Streaming)
```json
{
  "id": "geningai-1234567890",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "geningai/gpt3",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }]
}
```

## UID Management
- 10 UIDs kept in stock
- Each UID used for 3 requests then discarded
- Auto-replenishment after each request

## Deploy to Vercel
```bash
npm install -g vercel
vercel
```

## Environment
- Node.js on Vercel
- In-memory UID cache