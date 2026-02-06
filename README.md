# Puter-OpenClaw Proxy

Un server proxy Node.js che fa da ponte tra **OpenClaw.ai** e i modelli AI gratuiti di **Puter.js**.

## 🚀 Quick Start

```bash
# Installa le dipendenze
npm install

# Avvia il proxy
npm start
```

## 🍓 Installazione su Raspberry Pi

Ecco come eseguire il proxy su un Raspberry Pi per averlo sempre attivo nella tua rete locale.

### 1. Prerequisiti
Assicurati di avere **Node.js** (versione 18 o superiore) installato sul Raspberry.
```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa Node.js (versione 20 LTS raccomandata)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Installazione
Clona il repository ed entra nella cartella:
```bash
git clone https://github.com/emanuelediluzio/puter_openclaw_proxy.git
cd puter_openclaw_proxy
npm install
```

### 3. Avvio Automatico (Process Manager 2)
Per mantenere il proxy attivo anche se chiudi il terminale o riavvii il Raspberry, usa `pm2`.

```bash
# Installa pm2 globalmente
sudo npm install -g pm2

# Avvia il proxy
pm2 start puter-proxy.js --name "puter-proxy"

# Configura l'avvio automatico al boot
pm2 startup
# (esegui il comando che ti suggerisce pm2)
pm2 save
```

### 4. Utilizzo in Rete Locale
Ora puoi puntare OpenClaw dall'altro tuo computer usando l'IP del Raspberry Pi.

1. Trova l'IP del Raspberry: `hostname -I` (es. `192.168.1.50`)
2. Configura OpenClaw:
   - **Base URL**: `http://192.168.1.50:4000/v1`


## 🤖 Setup Completo "AI Box" (Proxy + OpenClaw su Raspberry)

Se vuoi che il Raspberry faccia tutto (sia da proxy che da agente), puoi installare OpenClaw direttamente lì.

1. **Installa OpenClaw** (richiede Node.js):
   ```bash
   sudo npm install -g openclaw
   ```

2. **Configura OpenClaw** per usare il proxy locale:
   - **Provider**: `openai`
   - **Base URL**: `http://localhost:4000/v1` (usiamo localhost perché sono sulla stessa macchina)
   - **Model**: `gpt-4o`

3. **Avvia OpenClaw con PM2**:
   ```bash
   pm2 start openclaw --name "openclaw-agent"
   pm2 save
   ```

Ora hai un agente AI autonomo attivo 24/7 sul tuo Raspberry Pi! 🚀


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
