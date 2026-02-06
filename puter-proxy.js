const express = require('express');
// puter-sdk exports a default class
const Puter = require('puter-sdk').default;
const app = express();

app.use(express.json());

// Inizializza Puter SDK
let puter;

async function initPuter() {
    puter = new Puter();
    console.log('Puter SDK inizializzato');
}

// Endpoint principale compatibile con OpenAI API
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const { messages, model, stream } = req.body;

        console.log(`Richiesta ricevuta - Model: ${model || 'gpt-4o'}, Messages: ${messages.length}`);

        // Chiamata a Puter AI
        const response = await puter.ai.chat(messages, {
            model: model || 'gpt-4o',
            stream: false
        });

        // Formattiamo la risposta nel formato OpenAI
        const openAIResponse = {
            id: 'chatcmpl-' + Math.random().toString(36).substr(2, 9),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model || 'gpt-4o',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: response.message?.content || response.toString(),
                },
                finish_reason: 'stop'
            }],
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
            }
        };

        res.json(openAIResponse);
    } catch (error) {
        console.error("Errore Puter:", error);
        res.status(500).json({
            error: {
                message: error.message,
                type: 'puter_error',
                code: 'internal_error'
            }
        });
    }
});

// Endpoint per streaming (SSE)
app.post('/v1/chat/completions/stream', async (req, res) => {
    try {
        const { messages, model } = req.body;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const response = await puter.ai.chat(messages, {
            model: model || 'gpt-4o',
            stream: true
        });

        // Gestione streaming
        for await (const chunk of response) {
            const data = {
                id: 'chatcmpl-' + Math.random().toString(36).substr(2, 9),
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model || 'gpt-4o',
                choices: [{
                    index: 0,
                    delta: {
                        content: chunk.text || ''
                    },
                    finish_reason: null
                }]
            };
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }

        // Segnale di fine stream
        res.write(`data: [DONE]\n\n`);
        res.end();
    } catch (error) {
        console.error("Errore streaming Puter:", error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// Endpoint per elencare i modelli disponibili
app.get('/v1/models', async (req, res) => {
    // Lista statica basata sui modelli supportati da Puter.js
    const start = 1699000000;
    const staticModels = [
        // OpenAI
        { id: 'gpt-4o', object: 'model', created: start, owned_by: 'openai' },
        { id: 'gpt-4o-mini', object: 'model', created: start, owned_by: 'openai' },
        { id: 'gpt-3.5-turbo', object: 'model', created: start, owned_by: 'openai' },

        // Anthropic
        { id: 'claude-3-5-sonnet', object: 'model', created: start, owned_by: 'anthropic' },
        { id: 'claude-3-opus', object: 'model', created: start, owned_by: 'anthropic' },
        { id: 'claude-3-haiku', object: 'model', created: start, owned_by: 'anthropic' },

        // Google
        { id: 'gemini-1.5-pro', object: 'model', created: start, owned_by: 'google' },
        { id: 'gemini-1.5-flash', object: 'model', created: start, owned_by: 'google' },
        { id: 'gemma-2-9b-it', object: 'model', created: start, owned_by: 'google' },

        // Meta / Llama
        { id: 'llama-3.1-405b', object: 'model', created: start, owned_by: 'meta-llama' },
        { id: 'llama-3.1-70b', object: 'model', created: start, owned_by: 'meta-llama' },
        { id: 'llama-3.1-8b', object: 'model', created: start, owned_by: 'meta-llama' },

        // Mistral
        { id: 'mistral-large', object: 'model', created: start, owned_by: 'mistralai' },
        { id: 'mixtral-8x22b', object: 'model', created: start, owned_by: 'mistralai' },
        { id: 'mixtral-8x7b', object: 'model', created: start, owned_by: 'mistralai' },

        // Microsoft
        { id: 'wizardlm-2-8x22b', object: 'model', created: start, owned_by: 'microsoft' },

        // DeepSeek
        { id: 'deepseek-coder-v2', object: 'model', created: start, owned_by: 'deepseek' },
        { id: 'deepseek-v2-chat', object: 'model', created: start, owned_by: 'deepseek' },
    ];

    try {
        // Tenta di recuperare la lista dinamica se autenticato
        const dynamicModelsMap = await puter.ai.listModels();
        // Se otteniamo risultati, convertiamoli nel formato OpenAI
        // La mappa è { 'openai': ['gpt-4o', ...], 'anthropic': [...] }
        const dynamicModels = [];
        for (const [provider, models] of Object.entries(dynamicModelsMap)) {
            for (const modelId of models) {
                dynamicModels.push({
                    id: modelId,
                    object: 'model',
                    created: start,
                    owned_by: provider
                });
            }
        }

        if (dynamicModels.length > 0) {
            console.log(`Recuperati ${dynamicModels.length} modelli da Puter API`);
            return res.json({ object: 'list', data: dynamicModels });
        }
    } catch (error) {
        // Ignora errori di auth/network e usa la lista statica
        console.warn("Impossibile recuperare lista dinamica (probabilmente non autenticato), uso lista statica fallback.");
    }

    res.json({
        object: 'list',
        data: staticModels
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Puter Proxy is running' });
});

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const PORT = process.env.PORT || 4000;

initPuter().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 Puter-OpenClaw Proxy attivo su http://localhost:${PORT}`);
        console.log(`\n📋 Configurazione OpenClaw:`);
        console.log(`   Provider: openai`);
        console.log(`   Base URL: http://localhost:${PORT}/v1`);
        console.log(`   API Key: any-string`);
        console.log(`   Model: gpt-4o (o altri modelli supportati)\n`);
    });
});
