# AI2PB Map - Area Inspector

An interactive web application that lets you **draw areas on a map** and instantly fetch **weather data** and **geographic features** (buildings, forests, parks, waterways) for those areas.

![Tech Stack](https://img.shields.io/badge/React-19.2-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite) ![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express) ![Mapbox](https://img.shields.io/badge/Mapbox-GL-3D6FBC)

---

## What Does This Project Do?

AI2PB Map is a **geographic data visualization tool** that combines three powerful things:

1. **Interactive Map Drawing** - Draw polygons on a Mapbox satellite map
2. **Real-time Weather Data** - Get current weather & hourly forecasts for any location
3. **OpenStreetMap Analysis** - Fetch & visualize buildings, forests, parks, waterways, and more

### Perfect for:
- Urban planning analysis
- Environmental research
- Infrastructure planning
- Geographic data analysis

---

## Quick Start (5 minutes)

### Prerequisites
- **Node.js** 16+ ([download here](https://nodejs.org/))
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Mapbox API token (already included in .env)

### Installation

```bash
# Clone/navigate to the project
cd /path/to/ai2pb-map

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Run the Project

Open **two terminal windows** in the project root (`/path/to/ai2pb-map`):

**Terminal 1 - Start Backend (API Server)**
```bash
npm run dev:server
```
Output:
```
Server listening on http://localhost:5174
```

**Terminal 2 - Start Frontend (Web App)**
```bash
npm run dev
```
Output:
```
Local:   http://localhost:5173
```

### Open in Browser
Visit: **http://localhost:5173**

You're ready to go!

---

## How to Use the App

### Step-by-Step Guide

1. **Draw an Area**
   - Click **"Paint Area"** button (top-left panel)
   - Click on the map to add points
   - Double-click to finish drawing
   - A bounding box is automatically calculated

2. **Get Weather Data**
   - With an area drawn, click **"Fetch Weather Data"**
   - A panel appears on the right showing:
     - Current temperature & conditions
     - Humidity, wind, precipitation
     - Hourly breakdown for 2 days
     - Wind & humidity trends

3. **Get Geographic Features**
   - With an area drawn, click **"Gather Intel"**
   - A panel shows:
     - Buildings (residential, commercial, offices, etc.)
     - Natural features (forests, water, grasslands)
     - Land use (parks, recreational areas)
     - Leisure areas (gardens, playgrounds, reserves)
     - Waterways (rivers, streams, canals)
   - Features are visualized on the map with different colors

---

## Project Structure

```
ai2pb-map/
├── server/                      # Backend (Express.js)
│   ├── index.js                # Main server file
│   ├── package.json            # Backend dependencies
│   └── node_modules/           # Backend packages
│
├── src/                        # Frontend (React)
│   ├── app/
│   │   └── App.jsx             # Main app with map & controls
│   ├── features/               # Feature components
│   │   ├── weather/
│   │   │   └── WeatherPanel.jsx
│   │   └── osm/
│   │       └── OSMPanel.jsx
│   ├── services/               # API clients
│   │   ├── apiBase.js          # API configuration
│   │   ├── mapbox.js           # Mapbox setup
│   │   ├── weatherClient.js    # Weather API client
│   │   └── osmClient.js        # OSM API client
│   ├── main.jsx                # React entry point
│   └── index.css               # Styling
│
├── .env                        # Environment variables
├── package.json                # Frontend dependencies
├── vite.config.js              # Vite configuration
└── README.md                   # This file
```

---

## How It Works (Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          FRONTEND (React + Vite)                         │   │
│  │  http://localhost:5173                                  │   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Map Display (Mapbox GL)                        │   │   │
│  │  │  - Interactive satellite map                    │   │   │
│  │  │  - Draw polygons & get bounding box            │   │   │
│  │  │  - Visualize geographic features               │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                        ↑ / ↓                              │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Feature Panels                                 │   │   │
│  │  │  - WeatherPanel: Current & hourly weather      │   │   │
│  │  │  - OSMPanel: Buildings & geographic features  │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                        ↑ / ↓                              │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Service Layer (API Clients)                    │   │   │
│  │  │  - weatherClient.js → calls /api/weather       │   │   │
│  │  │  - osmClient.js → calls /api/osm               │   │   │
│  │  │  - apiBase.js → API_BASE = localhost:5174      │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ↓ HTTP ↑                               │
└─────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓


┌──────────────────────────────────────────────────────────────┐
│              BACKEND (Express.js)                            │
│              http://localhost:5174                           │
│                                                               │
│  GET  /api/health                                           │
│       → Returns { ok: true }                                │
│                                                               │
│  GET  /api/weather?lat=X&lng=Y                             │
│       → Fetches from → open-meteo.com                       │
│       → Returns: Temperature, wind, humidity, hourly data  │
│                                                               │
│  POST /api/osm                                             │
│       Body: { bbox: { minLat, minLng, maxLat, maxLng } }   │
│       → Fetches from → overpass-api.de                      │
│       → Returns: Buildings, forests, parks, waterways      │
└──────────────────────────────────────────────────────────────┘
        ↓                    ↓                    ↓
        │                    │                    │
  ┌─────────────────────────────────────────────────────┐
  │         EXTERNAL APIs (Third-party services)        │
  ├─────────────────────────────────────────────────────┤
  │ • open-meteo.com → Weather data (free, no key)     │
  │ • overpass-api.de → OSM data (free, no key)        │
  │ • mapbox.com → Map tiles (uses VITE_MAPBOX_TOKEN)  │
  └─────────────────────────────────────────────────────┘
```

### Data Flow Example:

1. **User draws an area** → Polygon coordinates calculated
2. **User clicks "☁ Fetch Weather"**
   - Frontend calls: `GET http://localhost:5174/api/weather?lat=62.24&lng=25.75`
   - Backend forwards to: `https://api.open-meteo.com/v1/forecast?latitude=62.24&longitude=25.75&...`
   - Backend returns JSON to frontend
   - WeatherPanel displays real-time data

3. **User clicks "🌿 Fetch Nature & Buildings"**
   - Frontend calls: `POST http://localhost:5174/api/osm` with bounding box
   - Backend queries: `https://overpass-api.de/api/interpreter` with OSM query
   - Backend returns GeoJSON features
   - OSMPanel visualizes features on map with colors

---

## ⚙️ Environment Variables

The project uses a `.env` file for configuration:

```
# Mapbox Token (for map display)
VITE_MAPBOX_TOKEN=pk.eyJ1IjoiZmJqYWJhIiwiYSI6ImNtcDc1b2tnZzAxcHkydHNhdDgxZmFvd2gifQ.wi0tVoFHzndPL4gVQu2txA

# Backend API Base URL (where frontend sends requests)
VITE_API_BASE=http://localhost:5174
```

**Do NOT commit this file if you use your own Mapbox token!** Add to `.gitignore`.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | React 19.2 | UI component library |
| **Build Tool** | Vite 8.0 | Fast development server & builds |
| **Maps** | Mapbox GL 3.23 | Interactive map visualization |
| **Drawing** | Mapbox GL Draw 1.5 | Polygon drawing on map |
| **Backend** | Express 4.19 | Node.js server for API proxying |
| **Networking** | CORS | Cross-origin requests between frontend & backend |

---

## 📡 API Endpoints

### Frontend Calls These Endpoints:

#### 1. Health Check
```
GET /api/health
Response: { ok: true }
```

#### 2. Weather Data
```
GET /api/weather?lat=62.24&lng=25.75&signal=...

Response:
{
  "current": {
    "temperature_2m": 15.3,
    "relative_humidity_2m": 65,
    "apparent_temperature": 14.2,
    "precipitation": 0.5,
    "weather_code": 61,
    "wind_speed_10m": 3.5,
    "wind_direction_10m": 220
  },
  "hourly": {
    "time": ["2024-05-16T12:00", "2024-05-16T13:00", ...],
    "temperature_2m": [15.3, 15.8, ...],
    "precipitation": [0.5, 0.2, ...],
    "weather_code": [61, 63, ...],
    "wind_speed_10m": [3.5, 3.8, ...],
    "relative_humidity_2m": [65, 63, ...]
  }
}
```

#### 3. OpenStreetMap Data
```
POST /api/osm
Body:
{
  "bbox": {
    "minLat": 62.24,
    "minLng": 25.75,
    "maxLat": 62.25,
    "maxLng": 25.76
  }
}

Response:
{
  "elements": [
    {
      "type": "way",
      "id": 123456,
      "tags": {
        "building": "residential",
        "name": "Main Street Building"
      },
      "geometry": [
        { "lat": 62.24, "lon": 25.75 },
        { "lat": 62.241, "lon": 25.75 },
        ...
      ]
    },
    ...
  ]
}
```

---

## 🐛 Troubleshooting

### Frontend won't load (Blank page)
```
❌ Problem: http://localhost:5173 shows blank page
✅ Solution: Check browser console (F12) for errors. Make sure:
   - npm run dev is running in Terminal 2
   - Mapbox token in .env is valid
```

### Weather works but OSM gives error
```
❌ Error: "OSM upstream error 406"
✅ Solution: Backend needs User-Agent header for Overpass API
   (Already fixed in current version - should work!)
```

### Backend not running
```
❌ Problem: "Cannot GET /api/weather"
✅ Solution: Check Terminal 1:
   - Run: npm run dev:server
   - Should say: "Server listening on http://localhost:5174"
```

### Map shows blank/gray
```
❌ Problem: Map tiles not loading
✅ Solution: Check Mapbox token in .env is correct
   Get a new one at: https://account.mapbox.com/tokens/create
```

### Ports already in use
```
❌ Error: "EADDRINUSE: address already in use :::5174"
✅ Solution: Kill existing processes:
   # Find what's using port 5174
   lsof -i :5174
   # Kill the process
   kill -9 <PID>
```

---

## 📚 Learning Resources

- **Mapbox GL Documentation**: https://docs.mapbox.com/mapbox-gl-js/
- **Overpass API Guide**: https://wiki.openstreetmap.org/wiki/Overpass_API
- **Open-Meteo Weather API**: https://open-meteo.com/en/docs
- **React Guide**: https://react.dev
- **Express.js Guide**: https://expressjs.com/

---

## 🎨 Features & Colors

### Weather Icons
- ☀️ Clear sky
- 🌤️ Mainly clear
- ⛅ Partly cloudy
- ☁️ Overcast
- 🌫️ Fog
- 🌧️ Rain
- ❄️ Snow
- ⛈️ Thunderstorm

### OSM Feature Colors
- 🏗️ **Buildings** (purple) - Residential, commercial, offices
- 🌿 **Natural** (green) - Forests, water, grasslands
- 🗾 **Land Use** (light green) - Farmland, meadows
- 🌳 **Parks** (light green) - Parks, gardens, reserves
- 💧 **Waterways** (blue) - Rivers, streams, canals

---

## 📝 Development Notes

### Vite Configuration
- Hot Module Reload (HMR) enabled for fast development
- React Fast Refresh for instant component updates

### Backend Features
- CORS enabled for frontend requests
- JSON body parsing (1MB limit)
- HTTPS forwarding to external APIs
- Error handling with appropriate HTTP status codes

### Performance
- Mapbox vector tiles (efficient for large datasets)
- Request cancellation (AbortController) when panels close
- Lazy feature loading (only fetch when requested)

---

## 🚀 Deployment

To deploy this project:

1. **Build frontend:**
   ```bash
   npm run build
   # Creates dist/ folder
   ```

2. **Deploy frontend** to Vercel, Netlify, or any static host

3. **Deploy backend** to Heroku, Railway, or any Node.js host

4. **Update .env:**
   - `VITE_MAPBOX_TOKEN` stays the same (public token)
   - `VITE_API_BASE` changes to your deployed backend URL

---

## 📄 License

MIT License - Feel free to use, modify, and distribute.

---

## 🤝 Contributing

Found a bug or have a feature idea? Feel free to:
1. Test the app thoroughly
2. Document the issue
3. Suggest improvements

---

## ❓ FAQ

**Q: Do I need API keys for weather or OSM data?**
A: No! Both open-meteo.com and overpass-api.de are free with no API key required.

**Q: Can I use a different map provider?**
A: Yes! Replace Mapbox with OpenStreetMap using Leaflet or other libraries.

**Q: What's the maximum area I can draw?**
A: There's no hard limit, but larger areas = slower Overpass API responses.

**Q: How far back does weather history go?**
A: Open-Meteo provides current + 2-day forecast. No historical data in free tier.

**Q: Can I export the drawn areas?**
A: Yes! Click "Copy JSON" to get coordinates, then paste into any GIS tool.

---

**Happy mapping! 🗺️✨**
