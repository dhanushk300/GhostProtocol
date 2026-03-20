const socket = window.io();

let myName     = "";
let myId       = "";
let nodes      = [];
let locations  = {};
let msgCount   = 0;
let totalHops  = 0;
let typingTimer;

// ─── JOIN ────────────────────────────────────────────────────────────────────

function joinMesh() {
  const input = document.getElementById("username");
  myName = input.value.trim();
  if (!myName) { input.focus(); return; }

  const btn = document.getElementById("join-btn");
  btn.innerHTML = "<span>Joining mesh...</span>";
  btn.disabled  = true;

  socket.emit("join", { name: myName });
  myId = socket.id;

  document.getElementById("join-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("my-badge").textContent = `YOU: ${myName}`;

  addSystemMessage(`You joined the mesh as "${myName}" — broadcasting presence via BLE`);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────

function sendMessage() {
  const input = document.getElementById("msg-input");
  const text  = input.value.trim();
  if (!text) return;
  socket.emit("send_message", { text, isSOS: false });
  input.value = "";
}

function notifyTyping() {
  socket.emit("typing");
}

// ─── SOS ─────────────────────────────────────────────────────────────────────

function triggerSOS() {
  document.getElementById("sos-modal").classList.remove("hidden");
}

function closeSosModal() {
  document.getElementById("sos-modal").classList.add("hidden");
}

function confirmSOS() {
  const msg = document.getElementById("sos-input").value.trim();
  socket.emit("sos", { message: msg });
  closeSosModal();
  document.getElementById("sos-input").value = "";
}

function closeSOS() {
  document.getElementById("sos-overlay").classList.add("hidden");
}

// ─── LOCATION ─────────────────────────────────────────────────────────────────

function shareLocation() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      socket.emit("share_location", { location: loc });
      addSystemMessage("📍 Your GPS location broadcast to mesh network");
    },
    () => {
      // Demo location: Bengaluru + random offset
      const loc = {
        lat: 12.9716 + (Math.random() - 0.5) * 0.08,
        lng: 77.5946 + (Math.random() - 0.5) * 0.08,
      };
      socket.emit("share_location", { location: loc });
      addSystemMessage("📍 Demo location broadcast to mesh (GPS unavailable)");
    }
  );
}

// ─── AI REPORT ────────────────────────────────────────────────────────────────

async function getMeshReport() {
  const recentMsgs = [...document.querySelectorAll(".msg-text")]
                      .map(m => m.textContent).slice(-8);
  const sosCount   = [...document.querySelectorAll(".message.sos")].length;
  const nodeNames  = nodes.map(n => n.name);

  showAILoading(true);

  try {
    const res = await fetch("/ai-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeNames,
        recentMsgs,
        sosCount,
        locationCount: Object.keys(locations).length,
      }),
    });

    const data = await res.json();
    showAILoading(false);

    if (data.error) {
      showAIOutput("⚠️ " + data.error, false);
    } else {
      showAIOutput("🤖 " + data.report, true);
    }

  } catch (err) {
    showAILoading(false);
    showAIOutput("⚠️ Server error. Is npm start running?", false);
  }
}

async function getSOSAnalysis(sos) {
  try {
    const res = await fetch("/ai-sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:     sos.text,
        location: sos.location,
      }),
    });
    const data = await res.json();
    return data.analysis || null;
  } catch {
    return null;
  }
}

async function translateMessage(id, text, langName) {
  const out   = document.getElementById(`translated-${id}`);
  const flags = { Hindi: "🇮🇳", Kannada: "🟠", Tamil: "🔵", Malayalam: "🟢" };

  out.textContent = `Translating to ${langName}...`;
  out.classList.remove("hidden");

  try {
    const res = await fetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, langName }),
    });

    const data = await res.json();

    if (data.error) {
      out.textContent = "⚠️ " + data.error;
    } else {
      out.innerHTML = `${flags[langName] || "🌐"} <strong>${langName}:</strong> ${data.translation}`;
    }

  } catch {
    out.textContent = `⚠️ Translation to ${langName} failed. Try again.`;
  }
}

function showAILoading(show) {
  document.getElementById("ai-loading").classList.toggle("hidden", !show);
  document.getElementById("ai-output").classList.add("hidden");
}

function showAIOutput(text, success) {
  const el = document.getElementById("ai-output");
  el.textContent = text;
  el.className   = "ai-output" + (success ? " success" : " error");
  el.classList.remove("hidden");
}

// ─── SOCKET EVENTS ────────────────────────────────────────────────────────────

socket.on("connect", () => { myId = socket.id; });

socket.on("new_message", (msg) => {
  const isMe = msg.from === myName;
  addMessage(msg, isMe);
  msgCount++;
  totalHops += msg.hops || 0;
  updateStats();
});

socket.on("sos_alert", async (sos) => {
  if (sos.from === myName) return;

  // Flash screen red
  document.body.classList.add("sos-flash");
  setTimeout(() => document.body.classList.remove("sos-flash"), 800);

  const overlay = document.getElementById("sos-overlay");
  document.getElementById("sos-from").textContent = `FROM: ${sos.from}`;
  document.getElementById("sos-text").textContent = sos.text;
  document.getElementById("sos-location").textContent = sos.location
    ? `📍 ${sos.location.lat.toFixed(4)}, ${sos.location.lng.toFixed(4)}`
    : "📍 Location unknown";

  overlay.classList.remove("hidden");

  // Get Claude's rescue advice
  const analysis = await getSOSAnalysis(sos);
  if (analysis) {
    document.getElementById("sos-ai").innerHTML = `<strong>🤖 AI Rescue Advisor:</strong><br/>${analysis}`;
  }
});

socket.on("mesh_update", (updatedNodes) => {
  nodes = updatedNodes;
  renderNodes();
  renderHopCanvas();
  updateStats();
});

socket.on("location_update", (data) => {
  locations[data.id] = data;
  renderLocationList();
  renderMapCanvas();
});

socket.on("system", (data) => {
  addSystemMessage(data.text);
});

socket.on("peer_typing", (data) => {
  const el = document.getElementById("typing-indicator");
  el.textContent = `${data.name} is typing...`;
  el.classList.remove("hidden");
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => el.classList.add("hidden"), 2000);
});

socket.on("hop_animation", (data) => {
  animateHop(data.from, data.to);
});

// ─── RENDER FUNCTIONS ─────────────────────────────────────────────────────────

function addMessage(msg, isMe) {
  const container = document.getElementById("messages");

  const div = document.createElement("div");
  div.className = `message ${isMe ? "mine" : "theirs"} ${msg.isSOS ? "sos" : ""}`;
  div.id = `msg-wrap-${msg.id}`;

  const routeText = msg.route && msg.route.length > 1
    ? `via ${msg.route.filter(n => n !== msg.from).join(" → ")}`
    : "direct";

  div.innerHTML = `
    <div class="msg-meta-top">
      <span class="msg-from">${msg.isSOS ? "🆘 " : ""}${msg.from}</span>
      <span class="msg-time">${msg.timestamp}</span>
    </div>
    <div class="msg-text" id="text-${msg.id}">${msg.text}</div>
    <div class="msg-hop-info">
      <span class="hop-tag">${msg.hops} hop${msg.hops !== 1 ? "s" : ""}</span>
      <span class="route-tag">${routeText}</span>
      ${!isMe ? `
        <div class="translate-btns">
          <span class="translate-label">🌐</span>
          <button class="translate-btn" onclick="translateMessage('${msg.id}', \`${msg.text.replace(/`/g,"'")}\`, 'Hindi')">हिंदी</button>
          <button class="translate-btn" onclick="translateMessage('${msg.id}', \`${msg.text.replace(/`/g,"'")}\`, 'Kannada')">ಕನ್ನಡ</button>
          <button class="translate-btn" onclick="translateMessage('${msg.id}', \`${msg.text.replace(/`/g,"'")}\`, 'Tamil')">தமிழ்</button>
          <button class="translate-btn" onclick="translateMessage('${msg.id}', \`${msg.text.replace(/`/g,"'")}\`, 'Malayalam')">മലയാളം</button>
        </div>` : ""}
    </div>
    <div class="translated hidden" id="translated-${msg.id}"></div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addSystemMessage(text) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className   = "system-msg";
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderNodes() {
  const list   = document.getElementById("nodes-list");
  const badges = document.getElementById("node-badges");

  list.innerHTML = nodes.map(n => `
    <div class="node-row">
      <span class="node-signal"></span>
      <span class="node-name">${n.name}</span>
      ${n.name === myName ? '<span class="you-tag">YOU</span>' : ""}
      ${locations[n.id] ? '<span class="loc-tag">📍</span>' : ""}
    </div>
  `).join("");

  badges.innerHTML = nodes.map(n => `
    <span class="node-badge ${n.name === myName ? "mine" : ""}">${n.name}</span>
  `).join("");
}

function renderLocationList() {
  const list = document.getElementById("location-list");
  const locs = Object.values(locations);
  list.innerHTML = locs.map(l => `
    <div class="loc-row">
      <span class="loc-name">📍 ${l.name}</span>
      <span class="loc-coords">${l.location.lat.toFixed(3)}, ${l.location.lng.toFixed(3)}</span>
    </div>
  `).join("") || '<p class="empty-hint">No locations shared yet</p>';
}

function updateStats() {
  document.getElementById("stat-nodes").textContent = nodes.length;
  document.getElementById("stat-msgs").textContent  = msgCount;
  document.getElementById("stat-hops").textContent  =
    msgCount > 0 ? (totalHops / msgCount).toFixed(1) : "0";
}

// ─── HOP CANVAS ───────────────────────────────────────────────────────────────

function getNodePositions() {
  const canvas = document.getElementById("hop-canvas");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r  = Math.min(cx, cy) - 28;
  const pos = {};
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    pos[n.name] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return pos;
}

function renderHopCanvas() {
  const canvas = document.getElementById("hop-canvas");
  const ctx    = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pos = getNodePositions();

  // Draw connections
  const names = Object.keys(pos);
  ctx.strokeStyle = "rgba(127,90,240,0.15)";
  ctx.lineWidth   = 1;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      ctx.beginPath();
      ctx.moveTo(pos[names[i]].x, pos[names[i]].y);
      ctx.lineTo(pos[names[j]].x, pos[names[j]].y);
      ctx.stroke();
    }
  }

  // Draw nodes
  nodes.forEach(n => {
    const p      = pos[n.name];
    const isMe   = n.name === myName;
    ctx.beginPath();
    ctx.arc(p.x, p.y, isMe ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? "#2cb67d" : "#7f5af0";
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font      = "9px Space Mono";
    ctx.textAlign = "center";
    ctx.fillText(n.name.slice(0, 5), p.x, p.y + 20);
  });
}

function animateHop(fromName, toName) {
  const canvas = document.getElementById("hop-canvas");
  const ctx    = canvas.getContext("2d");
  const pos    = getNodePositions();
  const from   = pos[fromName];
  const to     = pos[toName];
  if (!from || !to) return;

  let t = 0;
  const draw = () => {
    renderHopCanvas();
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    // Trail line
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#e63946";
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Moving packet
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#e63946";
    ctx.fill();

    t += 0.06;
    if (t < 1) requestAnimationFrame(draw);
    else renderHopCanvas();
  };
  draw();
}

// ─── MAP CANVAS ──────────────────────────────────────────────────────────────

function renderMapCanvas() {
  const locs = Object.values(locations);
  const empty  = document.getElementById("map-empty");
  const canvas = document.getElementById("map-canvas");

  if (locs.length === 0) {
    empty.classList.remove("hidden");
    canvas.classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  canvas.classList.remove("hidden");

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background grid
  ctx.strokeStyle = "rgba(127,90,240,0.08)";
  ctx.lineWidth   = 1;
  for (let i = 0; i < 200; i += 20) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 200); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(200, i); ctx.stroke();
  }

  // Normalize lat/lng to canvas
  const lats = locs.map(l => l.location.lat);
  const lngs = locs.map(l => l.location.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 20;

  const toX = (lng) => locs.length === 1 ? 100 :
    pad + ((lng - minLng) / (maxLng - minLng || 1)) * (200 - 2 * pad);
  const toY = (lat) => locs.length === 1 ? 100 :
    pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (200 - 2 * pad);

  // Draw connections between nodes
  locs.forEach((a, i) => {
    locs.forEach((b, j) => {
      if (i >= j) return;
      ctx.beginPath();
      ctx.moveTo(toX(a.location.lng), toY(a.location.lat));
      ctx.lineTo(toX(b.location.lng), toY(b.location.lat));
      ctx.strokeStyle = "rgba(127,90,240,0.3)";
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  });

  // Draw nodes
  locs.forEach(l => {
    const x    = toX(l.location.lng);
    const y    = toY(l.location.lat);
    const isMe = l.name === myName;

    // Pulse ring
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? "rgba(44,182,125,0.15)" : "rgba(127,90,240,0.15)";
    ctx.fill();

    // Node dot
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? "#2cb67d" : "#7f5af0";
    ctx.fill();

    // Label
    ctx.fillStyle   = "rgba(255,255,255,0.8)";
    ctx.font        = "9px Space Mono";
    ctx.textAlign   = "center";
    ctx.fillText(l.name.slice(0, 6), x, y - 14);
  });
}