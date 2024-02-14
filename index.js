const express = require("express");
const app = express();
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
app.use(cors());

const server = http.createServer(app);
const io = new Server(server);


const ACTIONS = {
  JOIN: 'join',
  JOINED: 'joined',
  DISCONNECTED: 'disconnected',
  MESSAGE_RECEIVED: 'message-received',
};

const roomMessages = {};

function getAllClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        userName: io.sockets.sockets.get(socketId).userName, 
      };
    }
  );
}

function sendPreviousMessages(socket, roomId) {
  const messages = roomMessages[roomId] || [];
  messages.forEach((messageObj) => {
    const { userName, message } = messageObj;
    socket.emit(ACTIONS.MESSAGE_RECEIVED, { userName, message });
  });
}

io.on("connection", (socket) => {
  socket.on(ACTIONS.JOIN, ({ roomId, userName }) => {
    console.log("join", roomId, userName);
    socket.join(roomId);
    socket.userName = userName;
    sendPreviousMessages(socket, roomId);
    const allClients = getAllClients(roomId);
    allClients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        allClients,
        userName,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.MESSAGE_RECEIVED, ({ roomId, message }) => {
    console.log("message-received", roomId, message);
    // Store the message
    roomMessages[roomId] = roomMessages[roomId] || [];
    roomMessages[roomId].push({ userName: socket.userName, message }); 
    const allClients = getAllClients(roomId);
    allClients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.MESSAGE_RECEIVED, { userName: socket.userName, message }); 
    });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        userName: socket.userName,
      });
    });
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
