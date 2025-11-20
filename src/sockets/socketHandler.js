// sockets/socketHandler.js
const { Server } = require('socket.io');
const chatService = require('../services/chatService');
const ChatSession = require('../models/ChatSession');
const logger = console; // simple logger

// Try to obtain a fetch function (Node 18+ has global.fetch).
let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    // node-fetch v2 style require (v3 is ESM-only; this will work if v2 is installed)
    // If not installed, we'll still work with mock replies.
    // eslint-disable-next-line global-require
    const nodeFetch = require('node-fetch');
    fetchFn = nodeFetch;
  } catch (_err) {
    fetchFn = null;
  }
}

/**
 * generateAIReply - calls Groq Chat Completions API if GROQ_API_KEY is set.
 * Falls back to a mock reply if no key or fetch unavailable.
 *
 * @param {string} userText
 * @returns {Promise<string>}
 */
async function generateAIReply(userText) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !fetchFn) {
    return `You said: "${userText}". (Mock reply — no GROQ_API_KEY configured.)`;
  }

  try {
    const resp = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: userText }
        ],
        max_tokens: 300,
        temperature: 0.2
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      logger.error('Groq API responded with error', resp.status, txt);
      return `AI service error (status ${resp.status}).`;
    }

    const data = await resp.json();
    const aiText = data?.choices?.[0]?.message?.content;
    return aiText ? aiText.trim() : 'AI returned no content.';
  } catch (err) {
    logger.error('generateAIReply error:', err);
    return `AI call failed: ${err.message || err}`;
  }
}

/**
 * Export function to attach socket.io to existing HTTP server
 * @param {http.Server} server
 */
module.exports = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST']
    },
    // you can adjust pingInterval/pingTimeout/socket options here if needed
  });

  io.on('connection', (socket) => {
    logger.log(`[SOCKET] connected: ${socket.id}`);

    socket.on('join_chat', async ({ sessionId, isAdmin }) => {
      if (!sessionId) return;
      socket.join(sessionId);

      if (!isAdmin) {
        try {
          await chatService.upsertSession({
            sessionId,
            userAgent: socket.handshake.headers['user-agent'] || '',
            ipAddress: socket.handshake.address
          });
        } catch (err) {
          logger.error('[SOCKET] Error upserting session on join_chat:', err);
        }
      }

      logger.log(`[SOCKET] ${socket.id} joined ${sessionId} (isAdmin=${!!isAdmin})`);
    });

    /**
     * USER MESSAGE
     * Expect: { sessionId, text, tempId? }
     * Behavior:
     *  - save message
     *  - emit authoritative message to sender (socket.emit)
     *  - broadcast to other sockets in room (socket.to(sessionId).emit)
     *  - optional: ai_typing events + save AI reply + emit AI reply similarly
     */
    socket.on('user_message', async ({ sessionId, text, tempId }) => {
      if (!sessionId || !text) return;

      logger.log('[SOCKET] user_message recv', { sessionId, socketId: socket.id, tempId });

      try {
        // ensure session exists and save user message
        const chat = await chatService.upsertSession({
          sessionId,
          userAgent: socket.handshake.headers['user-agent'] || '',
          ipAddress: socket.handshake.address
        });

        const userMsg = await chatService.saveMessage({
          chatId: chat._id,
          sender: 'USER',
          text
        });

        const userPayload = {
          id: userMsg._id,
          text: userMsg.text,
          sender: userMsg.sender,
          createdAt: userMsg.createdAt,
          tempId: tempId || null
        };

        // Log emits for debugging
        logger.log('[SOCKET] emitting new_message to SENDER', { socketId: socket.id, id: userPayload.id, tempId: userPayload.tempId });
        socket.emit('new_message', userPayload);

        logger.log('[SOCKET] broadcasting new_message to ROOM (excluding sender)', { room: sessionId, id: userPayload.id });
        socket.to(sessionId).emit('new_message', userPayload);

        // Notify typing (nice UX) - you may remove if not needed
        io.to(sessionId).emit('ai_typing', true);

        // Generate AI reply (may be sync/async depending on API)
        const aiText = await generateAIReply(text);

        // Done typing
        io.to(sessionId).emit('ai_typing', false);

        // Save AI message
        const aiMsg = await chatService.saveMessage({
          chatId: chat._id,
          sender: 'AI',
          text: aiText
        });

        const aiPayload = {
          id: aiMsg._id,
          text: aiMsg.text,
          sender: aiMsg.sender,
          createdAt: aiMsg.createdAt
        };

        // Emit AI reply to sender and others (sender also gets authoritative AI message)
        logger.log('[SOCKET] emitting AI reply to SENDER', { socketId: socket.id, id: aiPayload.id });
        socket.emit('new_message', aiPayload);

        logger.log('[SOCKET] broadcasting AI reply to ROOM (excluding sender)', { room: sessionId, id: aiPayload.id });
        socket.to(sessionId).emit('new_message', aiPayload);
      } catch (err) {
        logger.error('[SOCKET] Error handling user_message:', err);
        // notify sender of error so client can show feedback
        socket.emit('message_error', { error: 'save_failed', detail: err.message || String(err) });
      }
    });

    /**
     * ADMIN MESSAGE
     * Expect: { sessionId, text, tempId? }
     * Same pattern as user_message.
     */
    socket.on('admin_message', async ({ sessionId, text, tempId }) => {
      if (!sessionId || !text) return;

      logger.log('[SOCKET] admin_message recv', { sessionId, socketId: socket.id, tempId });

      try {
        const chatDoc = await ChatSession.findOne({ sessionId });
        if (!chatDoc) {
          logger.warn('[SOCKET] admin_message: session not found', { sessionId });
          socket.emit('message_error', { error: 'no_session' });
          return;
        }

        const msg = await chatService.saveMessage({
          chatId: chatDoc._id,
          sender: 'ADMIN',
          text
        });

        const payload = {
          id: msg._id,
          text: msg.text,
          sender: msg.sender,
          createdAt: msg.createdAt,
          tempId: tempId || null
        };

        logger.log('[SOCKET] emitting admin new_message to SENDER', { socketId: socket.id, id: payload.id, tempId: payload.tempId });
        socket.emit('new_message', payload);

        logger.log('[SOCKET] broadcasting admin new_message to ROOM (excluding sender)', { room: sessionId, id: payload.id });
        socket.to(sessionId).emit('new_message', payload);
      } catch (err) {
        logger.error('[SOCKET] Error handling admin_message:', err);
        socket.emit('message_error', { error: 'save_failed', detail: err.message || String(err) });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.log('[SOCKET] disconnected:', socket.id, reason);
    });
  });

  return io;
};
