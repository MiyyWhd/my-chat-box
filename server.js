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

// Track members per room
const members = {}; 
// Structure: { roomName: { socketId: { name, online:true } } }

io.on("connection", (socket) => {
  let currentRoom = null;
  let username = "Anonymous";

  // ---- Helpers ----
  function updateMembers(room) {
    const list = Object.values(members[room] || {});
    io.to(room).emit("members", list);
  }

  // Join/change room
  socket.on("join", ({ room, user }) => {
    const newUser = (user || "Anonymous").trim() || "Anonymous";

    // Leave old room if switching
    if (currentRoom) {
      socket.leave(currentRoom);
      if (members[currentRoom]) {
        delete members[currentRoom][socket.id];
        updateMembers(currentRoom);
      }
    }

    username = newUser;
    currentRoom = room;
    socket.join(room);

    // Add to members list
    if (!members[room]) members[room] = {};
    members[room][socket.id] = { name: username, online: true };
    updateMembers(room);

    // System messages
    socket.to(room).emit("system", {
      text: `${username} joined #${room}`,
      room,
      ts: Date.now(),
    });

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

  // Disconnect cleanup
  socket.on("disconnect", () => {
    if (currentRoom) {
      // Mark user offline
      if (members[currentRoom] && members[currentRoom][socket.id]) {
        members[currentRoom][socket.id].online = false;
        updateMembers(currentRoom);
        delete members[currentRoom][socket.id];
      }

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
