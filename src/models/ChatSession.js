const mongoose = require("mongoose");
const { Schema } = mongoose;

const ChatSessionSchema = new Schema({
    sessionId: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ChatSessionSchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("ChatSession", ChatSessionSchema);
