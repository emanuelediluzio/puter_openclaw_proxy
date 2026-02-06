<<<<<<< HEAD
# puter_openclaw_proxy
=======
# Puter-OpenClaw Proxy

Un server proxy Node.js che fa da ponte tra **OpenClaw.ai** e i modelli AI gratuiti di **Puter.js**.

## 🚀 Quick Start

```bash
# Installa le dipendenze
npm install

# Avvia il proxy
npm start
```

Il proxy sarà attivo su `http://localhost:4000`.

## ⚙️ Configurazione OpenClaw

Dopo aver avviato il proxy, configura OpenClaw con questi parametri:

| Parametro | Valore |
|-----------|--------|
| **Provider** | `openai` |
| **Base URL** | `http://localhost:4000/v1` |
| **API Key** | `any-string` (qualsiasi valore) |
| **Model** | `gpt-4o` (o altri modelli supportati) |

## 📋 Modelli Supportati

Puter.js supporta moltissimi modelli. Ecco i principali verificati:

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

### Altri
- `wizardlm-2-8x22b` (Microsoft)
- `deepseek-coder-v2` (DeepSeek)
- `deepseek-v2-chat` (DeepSeek)

> **Nota:** Il proxy tenta anche di recuperare la lista dinamica se l'SDK è autenticato. In caso contrario, usa questa lista di fallback.

## 🔌 Endpoints API

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (formato OpenAI) |
| `/v1/chat/completions/stream` | POST | Chat completions con streaming SSE |
| `/v1/models` | GET | Lista dei modelli disponibili |
| `/health` | GET | Health check del server |

## 📝 Note

- **Prima esecuzione**: Puter SDK potrebbe richiedere l'autenticazione via browser al primo utilizzo.
- **Streaming**: L'endpoint `/v1/chat/completions/stream` supporta Server-Sent Events per risposte in tempo reale.
- **Porta**: Di default usa la porta 4000. Puoi cambiarla con la variabile d'ambiente `PORT`.

## 🧪 Test Rapido

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```
>>>>>>> 40efd78 (Initial commit: Puter Proxy with OpenAI compatible API)
