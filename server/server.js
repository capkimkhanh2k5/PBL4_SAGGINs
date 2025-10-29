// server.js
const http = require("http");
const os = require("os");
const { Server } = require("socket.io");
const axios = require("axios");

const PORT = 4000;
const AI_SERVER_URL = "http://localhost:8000/handlereq";

// Function to get local LAN IP
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1"; // fallback
}

const HOST = getLocalIP();

// Create HTTP server
const server = http.createServer();

// Attach Socket.io
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at: http://${HOST}:${PORT}`);
});

// Handle client connections
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: socketId=${socket.id}`);

  // Listen for client requests
  socket.on("requestAI", async (data) => {
    try {
      //log the request.id
      console.log(`📩 Received request from socketId=${socket.id}, requestId=${data.id}`);
      // Forward request to AI server
      const response = await axios.post(AI_SERVER_URL, data, {
      });
      
      // Send AI server response to client
      socket.emit("responseAI", { status: "success", path: response.data.path , result : response.data.result, id: response.data.id, allocated: response.data.allocated });
    } catch (err) {
      console.error("❌ AI request failed:", err.message);
      socket.emit("responseAI", { status: "fail", error: err.message });
    } finally {
      console.log(`✅ Processed request for socketId=${socket.id}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: socketId=${socket.id}`);
  });
});
