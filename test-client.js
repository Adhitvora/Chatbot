// test-client.js
const { io } = require("socket.io-client");
const socket = io("http://localhost:4000");

socket.on("connect", () => {
    console.log("connected", socket.id);
    const sessionId = "test-session-123";

    socket.emit("join_chat", { sessionId, isAdmin: false });

    socket.emit("user_message", { sessionId, text: "Hello from test client!" });
});

socket.on("new_message", (msg) => {
    console.log("new_message:", msg);
});
