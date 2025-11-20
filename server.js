// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Express middleware
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Health check
app.get('/', (req, res) => res.send('Server running'));

// --- ROUTES ---
// NOTE: your routes folder is `routes/chatRoutes.js` according to files you sent
const chatRoutes = require('./src/routes/chatRoutes');
app.use('/api/chats', chatRoutes);

// --- SOCKET.IO ---
// Initialize socket handler after routes (socketHandler will attach to server)
const initSocket = require('./src/sockets/socketHandler');
initSocket(server);

// Connect to MongoDB (use fallback local DB if MONGO_URI not set)
const MONGO_URI = process.env.MONGO_URI ;

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('Mongo connected');
        server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Mongo connection error', err);
        process.exit(1);
    });
