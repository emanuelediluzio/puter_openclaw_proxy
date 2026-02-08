const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const TOKEN_FILE = path.join(__dirname, '.puter-token');

let puter;

// Load auth token from file or environment
function loadToken() {
    if (process.env.PUTER_AUTH_TOKEN) {
        return process.env.PUTER_AUTH_TOKEN;
    }
    try {
        return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    } catch {
        return null;
    }
}

function saveToken(token) {
    fs.writeFileSync(TOKEN_FILE, token, 'utf8');
    console.log('Token salvato in', TOKEN_FILE);
}

// Browser-based auth flow (works on headless too via manual URL visit)
function getAuthTokenManual(guiOrigin = 'https://puter.com') {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://localhost/');
            const token = url.searchParams.get('token');
            if (token) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<h1>Autenticazione completata! Puoi chiudere questa finestra.</h1>');
                server.close();
                resolve(token);
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Token mancante');
            }
        });

        server.listen(0, '0.0.0.0', function () {
            const port = this.address().port;
            const localIP = getLocalIP();
            const authUrl = `${guiOrigin}/?action=authme&redirectURL=${encodeURIComponent('http://' + localIP + ':' + port)}`;

            console.log('\n============================================');
            console.log('  AUTENTICAZIONE PUTER RICHIESTA');
            console.log('============================================');
            console.log('\nApri questo URL nel browser:');
            console.log(`\n  ${authUrl}\n`);
            console.log('Accedi con il tuo account Puter (gratuito).');
            console.log('Il proxy si avviera automaticamente dopo il login.\n');

            // Try to open browser (works if desktop env is available)
            try {
                const { exec } = require('child_process');
                exec(`xdg-open "${authUrl}" 2>/dev/null || open "${authUrl}" 2>/dev/null`);
            } catch {
                // Ignore - user can open manually
            }
        });
    });
}

function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Extract text content from Puter AI response (handles both OpenAI and Anthropic formats)
function extractContent(response) {
    if (!response) return '';

    const msg = response.message;
    if (!msg) return response?.toString?.() || '';

    // OpenAI format: message.content is a string
    if (typeof msg.content === 'string') {
        return msg.content;
    }

    // Anthropic format: message.content is array of {type: 'text', text: '...'}
    if (Array.isArray(msg.content)) {
        return msg.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');
    }

    return response?.toString?.() || '';
}

// Format error message (handles both string and object errors from Puter)
function formatError(err) {
    if (typeof err.message === 'string') return err.message;
    if (typeof err.message === 'object') return JSON.stringify(err.message);
    return String(err);
}

async function initPuter() {
    const { init } = require('@heyputer/puter.js/src/init.cjs');

    let token = loadToken();

    if (!token) {
        console.log('Nessun token Puter trovato. Avvio autenticazione...');
        token = await getAuthTokenManual();
        saveToken(token);
    }

    puter = init(token);
    console.log('Puter.js inizializzato con successo');

    // Verify token works with a test call
    try {
        const test = await puter.ai.chat('ping', { model: 'gpt-4o-mini' });
        const content = extractContent(test);
        console.log('Test AI riuscito:', content.substring(0, 80));
    } catch (err) {
        const errMsg = formatError(err);
        console.warn('Test AI fallito:', errMsg);
        // Token might be expired, re-authenticate
        if (errMsg.includes('auth') || errMsg.includes('token') || errMsg.includes('401') || errMsg.includes('log_in')) {
            console.log('Token scaduto. Riautenticazione...');
            try { fs.unlinkSync(TOKEN_FILE); } catch {}
            token = await getAuthTokenManual();
            saveToken(token);
            puter = init(token);
            console.log('Riautenticazione completata');
        }
    }
}

// --- CORS middleware (BEFORE routes) ---
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// --- Chat completions (OpenAI-compatible) ---
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const { messages, model, stream, temperature, max_tokens, tools, tool_choice, stream_options } = req.body;
        const useModel = model || 'gpt-4.1';

        console.log(`Richiesta - Model: ${useModel}, Messages: ${messages?.length || 0}, Stream: ${!!stream}, Tools: ${tools?.length || 0}`);

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: { message: 'messages is required and must be a non-empty array', type: 'invalid_request_error' }
            });
        }

        const chatOptions = { model: useModel };
        if (temperature !== undefined) chatOptions.temperature = temperature;
        if (max_tokens !== undefined) chatOptions.max_tokens = max_tokens;
        if (tools && tools.length > 0) chatOptions.tools = tools;
        if (tool_choice !== undefined) chatOptions.tool_choice = tool_choice;

        if (stream) {
            // --- Streaming response (SSE) ---
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            chatOptions.stream = true;
            const completionId = 'chatcmpl-' + Math.random().toString(36).substring(2, 11);

            try {
                const response = await puter.ai.chat(messages, chatOptions);

                // The official SDK returns a Node.js readable stream for streaming
                let buffer = '';
                const processLine = (line) => {
                    const trimmed = line.trim();
                    if (!trimmed) return;

                    // Parse SSE data from Puter
                    const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
                    try {
                        const data = JSON.parse(payload);
                        let content = '';

                        if (data.success && data.result?.message?.content) {
                            content = data.result.message.content;
                        } else if (data.type === 'text' && data.text) {
                            content = data.text;
                        } else if (typeof data === 'string') {
                            content = data;
                        }

                        if (content) {
                            const chunk = {
                                id: completionId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: useModel,
                                choices: [{
                                    index: 0,
                                    delta: { content },
                                    finish_reason: null
                                }]
                            };
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        }
                    } catch {
                        // Not JSON, treat as plain text chunk
                        if (payload && payload !== '[DONE]') {
                            const chunk = {
                                id: completionId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: useModel,
                                choices: [{
                                    index: 0,
                                    delta: { content: payload },
                                    finish_reason: null
                                }]
                            };
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        }
                    }
                };

                if (response && typeof response.on === 'function') {
                    // Node.js stream
                    response.on('data', (chunk) => {
                        buffer += chunk.toString();
                        const lines = buffer.split(/\r?\n/);
                        buffer = lines.pop();
                        for (const line of lines) processLine(line);
                    });

                    response.on('end', () => {
                        if (buffer) processLine(buffer);
                        // Send final chunk with finish_reason
                        const finalChunk = {
                            id: completionId,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: useModel,
                            choices: [{
                                index: 0,
                                delta: {},
                                finish_reason: 'stop'
                            }]
                        };
                        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                        res.write('data: [DONE]\n\n');
                        res.end();
                    });

                    response.on('error', (err) => {
                        console.error('Stream error:', err);
                        res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
                        res.end();
                    });
                } else if (response && typeof response[Symbol.asyncIterator] === 'function') {
                    // Async iterable
                    for await (const chunk of response) {
                        const text = chunk?.text || chunk?.message?.content || (typeof chunk === 'string' ? chunk : '');
                        if (text) {
                            const sseChunk = {
                                id: completionId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: useModel,
                                choices: [{
                                    index: 0,
                                    delta: { content: text },
                                    finish_reason: null
                                }]
                            };
                            res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
                        }
                    }
                    const finalChunk = {
                        id: completionId,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: useModel,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                    };
                    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                } else {
                    // Fallback: response is already complete (non-streamed)
                    const msg = response?.message || response;
                    const content = msg?.content || response?.toString() || '';
                    const toolCalls = msg?.tool_calls || response?.tool_calls;

                    if (toolCalls && Array.isArray(toolCalls)) {
                        // Send tool calls as a single chunk
                        const tcDelta = {
                            tool_calls: toolCalls.map((tc, i) => ({
                                index: i,
                                id: tc.id || `call_${Math.random().toString(36).substring(2, 11)}`,
                                type: 'function',
                                function: {
                                    name: tc.function?.name || tc.name,
                                    arguments: typeof tc.function?.arguments === 'string'
                                        ? tc.function.arguments
                                        : JSON.stringify(tc.function?.arguments || tc.arguments || {}),
                                }
                            }))
                        };
                        if (content) tcDelta.content = content;
                        const chunk = {
                            id: completionId,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: useModel,
                            choices: [{ index: 0, delta: tcDelta, finish_reason: null }]
                        };
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        const finalChunk = {
                            id: completionId,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: useModel,
                            choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }]
                        };
                        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                    } else {
                        const chunk = {
                            id: completionId,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: useModel,
                            choices: [{
                                index: 0,
                                delta: { content },
                                finish_reason: 'stop'
                            }]
                        };
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    }
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
            } catch (streamErr) {
                console.error('Errore streaming:', streamErr);
                res.write(`data: ${JSON.stringify({ error: { message: streamErr.message } })}\n\n`);
                res.end();
            }
        } else {
            // --- Non-streaming response ---
            const response = await puter.ai.chat(messages, chatOptions);

            const msg = response?.message || response;
            const content = extractContent(response);

            // Check if response contains tool calls
            const toolCalls = msg?.tool_calls || response?.tool_calls;

            const assistantMessage = {
                role: 'assistant',
                content: toolCalls ? (content || null) : content,
            };

            if (toolCalls && Array.isArray(toolCalls)) {
                assistantMessage.tool_calls = toolCalls.map((tc, i) => ({
                    id: tc.id || `call_${Math.random().toString(36).substring(2, 11)}`,
                    type: 'function',
                    function: {
                        name: tc.function?.name || tc.name,
                        arguments: typeof tc.function?.arguments === 'string'
                            ? tc.function.arguments
                            : JSON.stringify(tc.function?.arguments || tc.arguments || {}),
                    }
                }));
            }

            const openAIResponse = {
                id: 'chatcmpl-' + Math.random().toString(36).substring(2, 11),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: useModel,
                choices: [{
                    index: 0,
                    message: assistantMessage,
                    finish_reason: toolCalls ? 'tool_calls' : 'stop'
                }],
                usage: {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                }
            };

            res.json(openAIResponse);
        }
    } catch (error) {
        const errMsg = formatError(error);
        console.error('Errore chat completions:', errMsg);
        res.status(500).json({
            error: {
                message: errMsg,
                type: 'puter_error',
                code: 'internal_error'
            }
        });
    }
});

// --- List models (OpenAI-compatible) ---
app.get('/v1/models', async (req, res) => {
    const start = 1699000000;
    const fallbackModels = [
        { id: 'gpt-4o', object: 'model', created: start, owned_by: 'openai' },
        { id: 'gpt-4o-mini', object: 'model', created: start, owned_by: 'openai' },
        { id: 'gpt-4.1', object: 'model', created: start, owned_by: 'openai' },
        { id: 'gpt-4.1-mini', object: 'model', created: start, owned_by: 'openai' },
        { id: 'o3-mini', object: 'model', created: start, owned_by: 'openai' },
        { id: 'claude-3-5-sonnet', object: 'model', created: start, owned_by: 'anthropic' },
        { id: 'claude-3-haiku', object: 'model', created: start, owned_by: 'anthropic' },
        { id: 'gemini-2.0-flash', object: 'model', created: start, owned_by: 'google' },
        { id: 'gemini-1.5-pro', object: 'model', created: start, owned_by: 'google' },
        { id: 'llama-3.1-70b', object: 'model', created: start, owned_by: 'meta-llama' },
        { id: 'mistral-large', object: 'model', created: start, owned_by: 'mistralai' },
        { id: 'deepseek-chat', object: 'model', created: start, owned_by: 'deepseek' },
        { id: 'deepseek-reasoner', object: 'model', created: start, owned_by: 'deepseek' },
    ];

    res.json({ object: 'list', data: fallbackModels });
});

// --- Health check ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Puter Proxy is running', authenticated: !!puter });
});

// --- Start ---
const PORT = process.env.PORT || 4000;

initPuter().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        const localIP = getLocalIP();
        console.log(`\nPuter-OpenAI Proxy attivo:`);
        console.log(`  Local:   http://localhost:${PORT}`);
        console.log(`  Network: http://${localIP}:${PORT}`);
        console.log(`\nConfigurazione client:`);
        console.log(`  Base URL: http://localhost:${PORT}/v1`);
        console.log(`  API Key:  qualsiasi-stringa`);
        console.log(`  Model:    gpt-4o-mini (o altri)\n`);
    });
}).catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});
