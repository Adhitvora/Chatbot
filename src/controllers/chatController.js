// controllers/chatController.js
const chatService = require('../services/chatService');

/**
 * GET /api/chats
 */
exports.getAllChats = async (req, res, next) => {
    try {
        const chats = await chatService.getAllChatsWithMessages();
        res.json(chats);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/chats/:sessionId
 */
exports.getChatBySessionId = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const chat = await chatService.getChatBySessionId(sessionId);
        if (!chat) return res.status(404).json({ message: 'Chat not found' });
        res.json(chat);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/chats/send
 * Simple test endpoint to save a message (useful for Postman)
 */
exports.testSendMessage = async (req, res, next) => {
    try {
        const { sessionId, sender, text } = req.body;
        if (!sessionId || !sender || !text) {
            return res.status(400).json({ message: 'sessionId, sender, text required' });
        }

        const chat = await chatService.upsertSession({ sessionId });
        const message = await chatService.saveMessage({
            chatId: chat._id,
            sender,
            text
        });

        res.json({ message: 'saved', data: message });
    } catch (err) {
        next(err);
    }
};
