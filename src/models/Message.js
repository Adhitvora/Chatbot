const mongoose = require("mongoose");
const { Schema } = mongoose;

const MessageSchema = new Schema({
    chatId: { type: Schema.Types.ObjectId, ref: "ChatSession", required: true },
    sender: { type: String, enum: ["USER", "ADMIN", "AI"], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", MessageSchema);
