// services/chatService.js
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');

/**
 * Upsert chat session by sessionId.
 * Returns ChatSession document (Mongoose doc).
 */
exports.upsertSession = async ({ sessionId, userAgent, ipAddress }) => {
    let chat = await ChatSession.findOne({ sessionId });
    if (!chat) {
        chat = await ChatSession.create({ sessionId, userAgent, ipAddress });
    } else {
        chat.updatedAt = Date.now();
        await chat.save();
    }
    return chat;
};

exports.saveMessage = async ({ chatId, sender, text, attachments }) => {
    const msg = await Message.create({
        chatId,
        sender,
        text,
        attachments: attachments || []
    });
    return msg;
};

exports.getAllChatsWithMessages = async () => {
    const chats = await ChatSession.find().sort({ updatedAt: -1 }).lean();
    const withMessages = await Promise.all(
        chats.map(async (c) => {
            const messages = await Message.find({ chatId: c._id }).sort({ createdAt: 1 }).lean();
            return { ...c, messages };
        })
    );
    return withMessages;
};

exports.getChatBySessionId = async (sessionId) => {
    const chat = await ChatSession.findOne({ sessionId }).lean();
    if (!chat) return null;
    const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 }).lean();
    return { ...chat, messages };
};
