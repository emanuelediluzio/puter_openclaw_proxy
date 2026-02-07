# Puter-OpenClaw Proxy

A Node.js proxy server that bridges **OpenClaw.ai** with the free AI models provided by **Puter.js** - no API keys needed.

## How It Works

```
Telegram --> OpenClaw Gateway --> Puter Proxy (localhost:4000) --> Puter.js --> AI Models (GPT-4o, Claude, Gemini, etc.)
```

The proxy exposes an OpenAI-compatible API (`/v1/chat/completions`) that forwards requests to Puter.js, giving you free access to multiple AI models.

## Quick Start

```bash
# Install dependencies
npm install

# Start the proxy
npm start
```

On first run, you'll be prompted to authenticate with Puter (free account). Open the URL shown in the terminal, log in, and the token will be saved automatically.

The proxy will be active at `http://localhost:4000`.

## OpenClaw Configuration

OpenClaw must use a **custom provider name** (not `openai`) to avoid conflicts with built-in model definitions. Use `puter` as the provider and set `api: "openai-completions"` since the proxy only supports the `/v1/chat/completions` endpoint.

Add this to your `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "models": {
        "puter/gpt-4o": { "alias": "gpt-4o" }
      },
      "model": { "primary": "puter/gpt-4o" }
    }
  },
  "models": {
    "providers": {
      "puter": {
        "baseUrl": "http://127.0.0.1:4000/v1",
        "apiKey": "sk-placeholder",
        "api": "openai-completions",
        "models": [{ "id": "gpt-4o", "name": "GPT-4o (Puter)" }]
      }
    }
  }
}
```

**Important:** The provider MUST be called `puter` (not `openai`). If you use `openai`, OpenClaw will find the built-in `gpt-4o` model definition which points to `api.openai.com` and bypass the proxy entirely.

## Raspberry Pi Installation

### 1. Prerequisites
**Node.js 22+ is required** (OpenClaw is bleeding edge!).

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm (required for building OpenClaw)
sudo npm install -g pnpm
```

### 2. Installation

```bash
git clone https://github.com/emanuelediluzio/puter_openclaw_proxy.git
cd puter_openclaw_proxy
npm install
```

### 3. Auto-start with PM2

```bash
sudo npm install -g pm2

# Start the proxy
pm2 start puter-proxy.js --name "puter-proxy"

# Auto-start on boot
pm2 startup
pm2 save
```

### 4. Network Access

Find your Raspberry Pi's IP with `hostname -I` and configure OpenClaw on other devices:
- **Base URL**: `http://<raspberry-ip>:4000/v1`

## Complete "AI Box" Setup (Proxy + OpenClaw + Telegram)

Run everything on the Raspberry Pi:

1. **Install OpenClaw** (Official Repo):
   ```bash
   # Remove old/placeholder package if present
   npm uninstall -g openclaw

   # Clone official repo
   git clone https://github.com/OpenClaw/OpenClaw.git openclaw-app
   cd openclaw-app

   # Install dependencies and build
   npm install
   pnpm run build
   ```

2. **Start the proxy** (must be running first):
   ```bash
   pm2 start puter-proxy.js --name "puter-proxy"
   ```

3. **Run OpenClaw onboarding**:
   ```bash
   openclaw onboard
   ```
   - Select **local** gateway mode
   - Connect your **Telegram** bot (you'll need a bot token from @BotFather)
   - When asked for AI provider, choose custom/manual

4. **Configure the model** in `~/.openclaw/openclaw.json` (see config above)

5. **Start OpenClaw gateway with PM2**:
   ```bash
   pm2 start "openclaw gateway run --port 18789 --bind lan" --name "openclaw-gateway"
   pm2 save
   ```

Now you have an autonomous AI bot on Telegram running 24/7 on your Raspberry Pi.

## Supported Models

The proxy supports all models available through Puter.js:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `o3-mini` |
| Anthropic | `claude-3-5-sonnet`, `claude-3-haiku` |
| Google | `gemini-2.0-flash`, `gemini-1.5-pro` |
| Meta | `llama-3.1-70b` |
| Mistral | `mistral-large` |
| DeepSeek | `deepseek-chat`, `deepseek-reasoner` |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (OpenAI format, streaming supported) |
| `/v1/models` | GET | List available models |
| `/health` | GET | Server health check |

## Quick Test

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-placeholder" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Troubleshooting

- **401 Incorrect API key**: You're using `openai` as provider name. Change it to `puter` in your OpenClaw config.
- **Puter token expired**: Delete `.puter-token` and restart the proxy to re-authenticate.
- **Port 4000 in use**: Set `PORT=4001 npm start` and update your OpenClaw config accordingly.
