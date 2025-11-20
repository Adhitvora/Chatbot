// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// GET /api/chats  -> list chats with messages
router.get('/', chatController.getAllChats);

// GET /api/chats/:sessionId -> single chat with messages
router.get('/:sessionId', chatController.getChatBySessionId);

// POST /api/chats/send -> test endpoint to save message (for Postman)
router.post('/send', chatController.testSendMessage);

module.exports = router;
