# Puter-OpenClaw Proxy

A Node.js proxy server that bridges **OpenClaw.ai** with the free AI models provided by **Puter.js**.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the proxy
npm start
```

The proxy will be active at `http://localhost:4000`.

## ⚙️ OpenClaw Configuration

After starting the proxy, configure OpenClaw with these parameters:

| Parameter | Value |
|-----------|-------|
| **Provider** | `openai` |
| **Base URL** | `http://localhost:4000/v1` |
| **API Key** | `any-string` (any value works) |
| **Model** | `gpt-4o` (or other supported models) |

## 🍓 Raspberry Pi Installation

Here's how to run the proxy on a Raspberry Pi to keep it always active on your local network.

### 1. Prerequisites
Ensure **Node.js** (version 18 or higher) is installed on your Raspberry Pi.
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (version 20 LTS recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Installation
Clone the repository and enter the directory:
```bash
git clone https://github.com/emanuelediluzio/puter_openclaw_proxy.git
cd puter_openclaw_proxy
npm install
```

### 3. Auto-start (Process Manager 2)
To keep the proxy running even if you close the terminal or reboot the Raspberry Pi, use `pm2`.

```bash
# Install pm2 globally
sudo npm install -g pm2

# Start the proxy
pm2 start puter-proxy.js --name "puter-proxy"

# Configure auto-start at boot
pm2 startup
# (execute the command suggested by pm2)
pm2 save
```

### 4. Local Network Usage
Now you can point OpenClaw from your main computer using the Raspberry Pi's IP.

1. Find the Raspberry Pi IP: `hostname -I` (e.g. `192.168.1.50`)
2. Configure OpenClaw:
   - **Base URL**: `http://192.168.1.50:4000/v1`

## 🤖 Complete "AI Box" Setup (Proxy + OpenClaw on Raspberry)

If you want the Raspberry Pi to handle everything (acting as both proxy and agent), you can install OpenClaw directly on it.

1. **Install OpenClaw** (requires Node.js):
   ```bash
   sudo npm install -g openclaw
   ```

2. **Configure OpenClaw** to use the local proxy:
   - **Provider**: `openai`
   - **Base URL**: `http://localhost:4000/v1` (we use localhost as they are on the same machine)
   - **Model**: `gpt-4o`

3. **Start OpenClaw with PM2**:
   ```bash
   pm2 start node --name "openclaw-agent" -- node_modules/openclaw/index.js
   pm2 save
   ```

Now you have an autonomous AI agent running 24/7 on your Raspberry Pi! 🚀

## 📋 Supported Models

Puter.js supports many models. Here are the main verified ones:

### OpenAI
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-3.5-turbo`

### Anthropic
- `claude-3-5-sonnet`
- `claude-3-opus`
- `claude-3-haiku`

### Google
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemma-2-9b-it`

### Meta / Llama
- `llama-3.1-405b`
- `llama-3.1-70b`
- `llama-3.1-8b`

### Mistral
- `mistral-large`
- `mixtral-8x22b`
- `mixtral-8x7b`

### Others
- `wizardlm-2-8x22b` (Microsoft)
- `deepseek-coder-v2` (DeepSeek)
- `deepseek-v2-chat` (DeepSeek)

> **Note:** The proxy also attempts to fetch the dynamic list if the SDK is authenticated. Otherwise, it uses this fallback list.

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (OpenAI format) |
| `/v1/chat/completions/stream` | POST | Chat completions with SSE streaming |
| `/v1/models` | GET | List available models |
| `/health` | GET | Server health check |

## 📝 Notes

- **First Run**: Puter SDK might request authentication via browser on the first use (locally).
- **Streaming**: The `/v1/chat/completions/stream` endpoint supports Server-Sent Events for real-time responses.
- **Port**: Defaults to port 4000. You can change it with the `PORT` environment variable.

## 🧪 Quick Test

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```
