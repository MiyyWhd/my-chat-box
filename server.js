const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the single-page app
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  let currentRoom = null;
  let username = "Anonymous";

  // Join/change room
  socket.on("join", ({ room, user }) => {
    const newUser = (user || "Anonymous").trim() || "Anonymous";
    if (currentRoom) socket.leave(currentRoom);
    username = newUser;
    currentRoom = room;

    socket.join(room);
    // Notify others in room
    socket.to(room).emit("system", {
      text: `${username} joined #${room}`,
      room,
      ts: Date.now(),
    });

    // (Optional) send a small history or welcome just to the joining user
    socket.emit("system", {
      text: `You joined #${room}. Say hi!`,
      room,
      ts: Date.now(),
    });
  });

  // Chat messages scoped to the room
  socket.on("chat", ({ room, user, text }) => {
    const payload = {
      user: (user || "Anonymous").trim() || "Anonymous",
      text: (text || "").toString(),
      room,
      ts: Date.now(),
    };
    if (!room) return;
    io.to(room).emit("chat", payload);
  });

  socket.on("disconnect", () => {
    if (currentRoom) {
      socket.to(currentRoom).emit("system", {
        text: `${username} left #${currentRoom}`,
        room: currentRoom,
        ts: Date.now(),
      });
    }
  });
});

server.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
