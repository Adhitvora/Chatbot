// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

// request logger
app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Origin:${req.headers.origin}`);
    next();
});

// CORS - allow FRONTEND_ORIGIN (comma separated allowed)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true); // allow curl / server-to-server
        if (FRONTEND_ORIGIN === '*' || FRONTEND_ORIGIN.split(',').includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// example health
app.get('/', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// example POST (your existing chat handler)
app.post('/api/chats/send', async (req, res) => {
    try {
        const { sessionId, sender, text } = req.body || {};
        if (!sessionId || !sender || !text) return res.status(400).json({ error: 'missing sessionId/sender/text' });

        // TODO: replace with real logic
        const reply = { sessionId, sender: 'BOT', text: `Echo: ${text}`, ts: Date.now() };
        return res.json(reply);
    } catch (err) {
        console.error('POST /api/chats/send error', err);
        return res.status(500).json({ error: 'server error' });
    }
});

// GET chat by id (so frontend GET /api/chats/:id won't 404)
app.get('/api/chats/:id', (req, res) => {
    const id = req.params.id;
    // TODO: fetch messages from DB. For now return stub
    return res.json({
        id,
        messages: [{ sender: 'BOT', text: `This is stub for ${id}`, ts: Date.now() }]
    });
});

// create HTTP server + socket.io
const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    cors: {
        origin: FRONTEND_ORIGIN === '*' ? '*' : FRONTEND_ORIGIN.split(','),
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.on('connection', socket => {
    console.log('Socket connected', socket.id);
    socket.on('join', (data) => {
        console.log('join', data);
        // example: socket.join(data.sessionId)
    });
    socket.on('client-message', (msg) => {
        console.log('client-message', msg);
        // echo back
        socket.emit('bot-message', { text: `Server echo: ${msg.text}` });
    });
    socket.on('disconnect', () => console.log('Socket disconnected', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
