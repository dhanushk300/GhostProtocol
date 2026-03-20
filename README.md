# 👻 Ghost Protocol — Offline Mesh Communication

> **Unleashed 2026 Hackathon** | Track: Social Good + Open Innovation

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.6-blue)](https://socket.io) 
[![Claude AI](https://img.shields.io/badge/Claude-AI_Powered-purple)](https://anthropic.com)

---

## 🚨 The Problem

During disasters in India — earthquakes, floods, cyclones — **cell towers collapse exactly when people need them most**. Relief workers lose contact. Families can't reach each other. Rescue coordination breaks down.

> In the 2018 Kerala floods, communication blackouts affected over 5 million people for 72+ hours.

## 💡 The Solution

Ghost Protocol creates a **peer-to-peer mesh network** using Bluetooth Low Energy and WiFi Direct. Messages hop phone-to-phone with:

- ❌ No internet required
- ❌ No central server
- ❌ No SIM card needed
- ✅ Works in complete network blackouts

## ✨ Features

| Feature | Description |
|---|---|
| 📡 Mesh messaging | Messages hop across all nearby devices automatically |
| 🆘 SOS broadcast | One tap alerts the entire mesh with GPS location |
| 🤖 AI rescue advisor | Claude AI analyzes emergencies and suggests rescue steps |
| 🌐 Hindi translation | Auto-translate messages for Indian rescue workers |
| 📍 Offline maps | Real-time GPS location sharing across the mesh |
| 👁️ Hop visualizer | Live animation showing how messages travel through nodes |
| 📊 Mesh analytics | Track nodes, messages, and average hops in real time |

## 🏗️ Architecture

```
Phone A ──BLE──► Phone B ──WiFi Direct──► Phone C
   │                  │                       │
   └──── No internet at any step ─────────────┘
```

Each phone acts as both a **sender** and a **relay node** simultaneously.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Mesh simulation:** Socket.io (WebSockets)
- **Real Android:** Google Nearby Connections API (BLE + WiFi Direct)
- **AI:** Claude API (emergency analysis + translation)
- **Maps:** GPS Geolocation API

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/GhostProtocol.git
cd GhostProtocol
npm install
npm start
```

Open `http://localhost:3000` in **3+ browser tabs** to simulate multiple devices.

### Demo Steps
1. Open 3 tabs — each joins as a different "device"
2. Turn off internet on all tabs (they still work — that's the point!)
3. Send messages — watch them hop through all nodes
4. Hit 🆘 SOS on one tab — all others receive emergency alert
5. Click 📍 Share Location — see devices appear on mesh map
6. Add Claude API key in right panel for AI features

## 📱 Android Implementation

The production Android app uses Google Nearby Connections API:

```kotlin
// Discover nearby devices
Nearby.getConnectionsClient(context)
  .startAdvertising(username, SERVICE_ID, connectionCallback, options)
  .startDiscovery(SERVICE_ID, endpointCallback, discoveryOptions)

// Send message — auto-hops to all connected nodes
Nearby.getConnectionsClient(context)
  .sendPayload(endpointId, Payload.fromBytes(message.toByteArray()))
```

The web prototype demonstrates the **exact same mesh logic** — just using WebSockets instead of BLE for the browser demo.

## 🤖 AI Features (requires Claude API key)

Get a free API key at [console.anthropic.com](https://console.anthropic.com)

- **SOS Analysis** — Claude instantly suggests rescue actions when an SOS arrives
- **Situation Report** — Real-time AI assessment of the entire mesh network status
- **Hindi Translation** — Auto-translate messages for multi-language disaster response

## 🎯 Use Cases

- 🌊 Flood relief coordination (Kerala, Assam)
- 🏔️ Earthquake rescue operations
- 🏟️ Stadium/event emergencies
- 🌐 Areas with no cellular infrastructure


