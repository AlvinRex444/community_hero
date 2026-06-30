# 🚀 Community Hero – AI-Powered Hyperlocal Problem Solver

Community Hero is a production-style, full-stack AI-powered civic engagement platform built during the **Coding Ninjas × Google for Developers Hackathon** using **Google AI Studio**.

The platform enables citizens to intelligently report, verify, track, and collaborate on local civic issues such as potholes, fallen trees, water leakages, damaged streetlights, waste accumulation, flooding, electrical hazards, and other infrastructure problems.

By combining **live GPS**, **multimodal Gemini AI analysis**, **interactive mapping**, **community verification**, and **predictive infrastructure insights**, Community Hero transforms traditional complaint systems into an intelligent, transparent, and collaborative civic platform.

---

# 🌟 Core Features

## 🤖 1. AI-Powered Issue Reporting

Citizens can upload an image and describe the issue in natural language.

The backend securely sends the request to **Google Gemini 2.5 Flash** using the official **@google/genai** SDK.

Gemini automatically performs:

* Intelligent issue categorization
* AI-generated report title
* Severity assessment
* Confidence estimation
* Safety recommendations
* Municipal action suggestions
* Technical engineering analysis

Supported categories include:

* Roads & Potholes
* Fallen Tree / Road Obstruction
* Water Leakage
* Streetlight Failure
* Waste Management
* Flooding / Waterlogging
* Open Manhole
* Electrical Hazard
* Generic Infrastructure Issues

---

## 📍 2. Live GPS Location Detection

Community Hero integrates browser-based GPS to automatically detect the user's real-time location.

Features include:

* High-accuracy GPS
* Reverse geocoding
* Dynamic location display
* Automatic coordinate capture
* Interactive map positioning

---

## 🗺️ 3. Interactive Civic Map

Every reported issue is visualized on an interactive community map.

Features:

* Live location marker
* Issue markers
* Category filtering
* District filtering
* Severity visualization
* Real-time report browsing

---

## 👥 4. Community Verification

Citizens collaborate to verify reported issues.

Workflow:

Reported
⬇
Verified
⬇
In Progress
⬇
Resolved

This improves transparency and reduces false reports.

---

## 🏛️ 5. Municipal Control Panel

A simulated municipal dashboard demonstrates how local authorities can manage infrastructure issues.

Capabilities:

* View active reports
* Update issue status
* Monitor resolution timeline
* Track community verification

---

## 📊 6. Predictive AI Insights

Community Hero uses Gemini to analyze regional issue trends and generate predictive infrastructure insights.

Examples include:

* Road deterioration trends
* Water pipeline risks
* Flood-prone locations
* Infrastructure maintenance recommendations

---

## 🏆 7. Citizen Gamification

To encourage participation:

* XP System
* Citizen Badges
* Community Impact Points
* Recognition for active contributors

---

# ⚙️ Technical Highlights

* Production-style Express backend
* Google Gemini 2.5 Flash integration
* Gemini Vision multimodal image analysis
* Live GPS location services
* Category-aware AI pipeline
* Intelligent AI fallback engine
* Weighted issue classification
* Self-healing API middleware
* Smart server-side caching
* Responsive React frontend
* Google Cloud deployment

---

# 🏗️ System Architecture

```text
                    +----------------------+
                    |      React UI        |
                    +----------+-----------+
                               |
                         REST API
                               |
                    +----------v-----------+
                    | Express + TypeScript |
                    +----------+-----------+
                               |
             +-----------------+----------------+
             |                                  |
             |                                  |
     Google Gemini 2.5 Flash          OpenStreetMap
        Vision + Text AI            Reverse Geocoding
             |
      AI Analysis Engine
             |
   Category-Aware Templates
             |
     Predictive AI Insights
```

---

# 🛡️ Reliability Features

Community Hero includes multiple production-style reliability mechanisms.

### Intelligent Caching

Predictive AI responses are cached to reduce unnecessary Gemini API requests.

---

### Self-Healing Backend

If Gemini is temporarily unavailable:

* Cached insights are served automatically.
* Category-aware fallback insights are generated.
* Users receive informative notifications.
* The application remains fully functional.

---

### Category-Aware AI Pipeline

Gemini acts as the primary source of truth.

If Gemini is unavailable:

Weighted classification selects the most appropriate category before generating intelligent fallback analysis.

---

# 🛠️ Tech Stack

## Frontend

* React
* TypeScript
* Vite
* HTML5
* CSS3

## Backend

* Node.js
* Express.js
* TypeScript

## Artificial Intelligence

* Google AI Studio
* Google Gemini 2.5 Flash
* Gemini Vision
* Google GenAI SDK

## Location Services

* Browser Geolocation API
* OpenStreetMap Nominatim

## Deployment

* Google Cloud

## Version Control

* Git
* GitHub

---
Click to visit : https://community-hero-253347013398.asia-southeast1.run.app/

# 🚀 Getting Started

## Installation

```bash
git clone https://github.com/AlvinRex444/community_hero

cd community_hero

npm install
```

---

## Environment Variables

Create a `.env` file.

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
APP_URL=http://localhost:3000
```

---

## Run Development Server

```bash
npm run dev
```

Application:

```
http://localhost:3000
```

---

## Build Production

```bash
npm run build

npm start
```

---

# 📂 Project Structure

```text
community_hero/

├── src/
├── components/
├── server.ts
├── package.json
├── vite.config.ts
├── public/
├── assets/
└── README.md
```

---

# 🌐 Google Technologies Utilized

* Google AI Studio
* Google Gemini 2.5 Flash
* Gemini Vision
* Google GenAI SDK
* Google Cloud

---

# 📌 Future Improvements

* Push notifications
* Municipal dashboard authentication
* Multi-language support
* Analytics dashboard
* Heatmap clustering
* Mobile application

---

# 👨‍💻 Author

**Alvin Rex Tirkey**

Built during the **Coding Ninjas × Google for Developers Hackathon** using **Google AI Studio**.
