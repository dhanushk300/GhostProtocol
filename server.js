const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const fetch   = require("node-fetch");
const ANTHROPIC_KEY = "paste-your-key-here"; // ← paste your key here

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const nodes    = {};
const messages = [];

// ─── AI ROUTES ────────────────────────────────────────────────────────────────

app.post("/ai-report", async (req, res) => {
  const { nodeNames, recentMsgs, sosCount, locationCount } = req.body;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 250,
        messages: [{
          role:    "user",
          content: `You are an AI emergency coordinator monitoring a disaster mesh network in India.
Mesh status:
- Active nodes: ${nodeNames.join(", ") || "none"}
- Total devices: ${nodeNames.length}
- SOS alerts sent: ${sosCount}
- Recent messages: ${recentMsgs.join(" | ") || "none"}
- Locations shared: ${locationCount}
Give a concise 3-line situation report like a real emergency coordinator.
Format: Severity level, key observations, recommended action.
Be direct and urgent.`
        }],
      }),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ report: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: "AI report failed" });
  }
});

app.post("/ai-sos", async (req, res) => {
  const { text, location } = req.body;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 120,
        messages: [{
          role:    "user",
          content: `Emergency SOS on disaster mesh: "${text}"
Location: ${location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "unknown"}
Give exactly 2 urgent rescue actions in plain English. Be direct. Max 2 sentences.`
        }],
      }),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ analysis: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: "SOS analysis failed" });
  }
});

app.post("/translate", async (req, res) => {
  const { text, langName } = req.body;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{
          role:    "user",
          content: `Translate this emergency message to ${langName}. Return ONLY the translation, nothing else.\nMessage: "${text}"`,
        }],
      }),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ translation: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: "Translation failed" });
  }
});

// ─── MESH SOCKET ──────────────────────────────────────────────────────────────

io.on("connection", (socket) => {

  socket.on("join", (data) => {
    nodes[socket.id] = {
      id:       socket.id,
      name:     data.name,
      location: null,
      joinedAt: Date.now(),
    };
    io.emit("mesh_update", Object.values(nodes));
    io.emit("system", { text: `${data.name} joined the mesh network` });
    console.log(`[MESH] ${data.name} joined — ${Object.keys(nodes).length} nodes active`);
  });

  socket.on("send_message", (data) => {
    const msg = {
      id:        `msg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      from:      nodes[socket.id]?.name || "Unknown",
      fromId:    socket.id,
      text:      data.text,
      isSOS:     data.isSOS || false,
      timestamp: new Date().toLocaleTimeString(),
      hops:      Object.keys(nodes).length - 1,
      route:     Object.values(nodes).map(n => n.name),
    };
    messages.push(msg);
    io.emit("new_message", msg);

    Object.values(nodes).forEach((node, i) => {
      if (node.id !== socket.id) {
        setTimeout(() => {
          io.to(node.id).emit("hop_animation", {
            from:  nodes[socket.id]?.name,
            to:    node.name,
            msgId: msg.id,
          });
        }, i * 120);
      }
    });

    console.log(`[MSG] "${data.text}" from ${msg.from} — hopped to ${msg.hops} nodes`);
  });

  socket.on("share_location", (data) => {
    if (nodes[socket.id]) {
      nodes[socket.id].location = data.location;
      io.emit("location_update", {
        id:       socket.id,
        name:     nodes[socket.id].name,
        location: data.location,
      });
    }
  });

  socket.on("sos", (data) => {
    const sos = {
      id:        `sos_${Date.now()}`,
      from:      nodes[socket.id]?.name || "Unknown",
      fromId:    socket.id,
      text:      data.message || "Emergency! Need immediate help!",
      location:  nodes[socket.id]?.location,
      isSOS:     true,
      timestamp: new Date().toLocaleTimeString(),
      hops:      Object.keys(nodes).length - 1,
      route:     Object.values(nodes).map(n => n.name),
      priority:  "CRITICAL",
    };
    messages.push(sos);
    io.emit("new_message", sos);
    io.emit("sos_alert", sos);
    console.log(`[SOS] EMERGENCY from ${sos.from}`);
  });

  socket.on("typing", () => {
    socket.broadcast.emit("peer_typing", { name: nodes[socket.id]?.name });
  });

  socket.on("disconnect", () => {
    if (nodes[socket.id]) {
      const name = nodes[socket.id].name;
      delete nodes[socket.id];
      io.emit("mesh_update", Object.values(nodes));
      io.emit("system", { text: `${name} left the mesh network` });
      console.log(`[MESH] ${name} disconnected — ${Object.keys(nodes).length} nodes active`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n👻 Ghost Protocol mesh server running!`);
  console.log(`   Open http://localhost:${PORT} in multiple tabs to simulate mesh\n`);
});