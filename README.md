# Junction

This repository hosts the **AI2PB Map** project from Aalto Defence x Junction. It’s an interactive map app for battlefield intelligence utilizing OSINT data.

## What’s inside

- `ai2pb-map/` — React + Vite frontend and Express backend.

## Quick start

### Prerequisites

- Node.js 16+
- A Mapbox token in `ai2pb-map/.env` as `VITE_MAPBOX_TOKEN`

### Install

1. Install frontend dependencies:
	- `cd ai2pb-map`
	- `npm install`
2. Install backend dependencies:
	- `cd server`
	- `npm install`

### Run

Open two terminals in `ai2pb-map/`:

1. Backend:
	- `npm run dev:server`
2. Frontend:
	- `npm run dev`

The app runs at http://localhost:5173 and the API at http://localhost:5174.

## Key features

- Draw polygons on a Mapbox map.
- Fetch current weather and hourly forecasts.
- Gather intelligence on the area

## Scripts

From `ai2pb-map/`:

- `npm run dev` — start frontend
- `npm run dev:server` — start backend
- `npm run build` — production build
- `npm run lint` — lint frontend
