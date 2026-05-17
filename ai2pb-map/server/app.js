import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchWithRetry(url, { attempts = 3, timeoutMs = 8000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`upstream ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 200 * (i + 1) + Math.random() * 200));
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/weather", async (req, res) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).send("Invalid lat/lng");
        return;
      }

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", lat.toFixed(4));
      url.searchParams.set("longitude", lng.toFixed(4));
      url.searchParams.set(
        "current",
        [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "dew_point_2m",
          "surface_pressure",
          "cloud_cover",
          "visibility",
        ].join(",")
      );
      url.searchParams.set(
        "hourly",
        [
          "temperature_2m",
          "precipitation_probability",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
          "wind_gusts_10m",
          "relative_humidity_2m",
          "dew_point_2m",
          "visibility",
          "cloud_cover",
        ].join(",")
      );
      url.searchParams.set("forecast_days", "2");
      url.searchParams.set("wind_speed_unit", "ms");
      url.searchParams.set("timezone", "auto");

      const response = await fetchWithRetry(url.toString());
      if (!response.ok) {
        res.status(response.status).send(`Weather upstream error ${response.status}`);
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("[/api/weather]", err?.message || err);
      res.status(502).send(err?.message || "Weather proxy error");
    }
  });

  // Generic Overpass QL proxy — accepts { query: string }
  app.post("/api/overpass", async (req, res) => {
    try {
      const { query } = req.body || {};
      if (!query || typeof query !== "string") {
        res.status(400).send("Missing query");
        return;
      }
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ai2pb-map/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) {
        res.status(response.status).send(`Overpass upstream error ${response.status}`);
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).send(err.message || "Overpass proxy error");
    }
  });

  // Elevation proxy — open-meteo.com/v1/elevation
  app.get("/api/elevation", async (req, res) => {
    try {
      const { latitude, longitude } = req.query;
      if (!latitude || !longitude) {
        res.status(400).send("Missing latitude/longitude");
        return;
      }
      const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`;
      const response = await fetchWithRetry(url);
      if (!response.ok) {
        res.status(response.status).send(`Elevation upstream error ${response.status}`);
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(502).send(err.message || "Elevation proxy error");
    }
  });

  // geo.stat.fi WFS proxy — accepts { typeName, bbox }
  app.get("/api/statsfi", async (req, res) => {
    try {
      const { typeName, bbox } = req.query;
      if (!typeName || !bbox) {
        res.status(400).send("Missing typeName or bbox");
        return;
      }
      const url = new URL("https://geo.stat.fi/geoserver/vaestoruutu/wfs");
      url.searchParams.set("service", "WFS");
      url.searchParams.set("version", "2.0.0");
      url.searchParams.set("request", "GetFeature");
      url.searchParams.set("typeName", typeName);
      url.searchParams.set("bbox", bbox);
      url.searchParams.set("outputFormat", "application/json");
      url.searchParams.set("srsName", "EPSG:4326");
      const response = await fetch(url.toString());
      if (!response.ok) {
        res.status(response.status).send(`StatsFi upstream error ${response.status}`);
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(502).send(err.message || "StatsFi proxy error");
    }
  });

  app.post("/api/osm", async (req, res) => {
    try {
      const { bbox } = req.body || {};
      const minLat = Number(bbox?.minLat);
      const minLng = Number(bbox?.minLng);
      const maxLat = Number(bbox?.maxLat);
      const maxLng = Number(bbox?.maxLng);

      if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) {
        res.status(400).send("Invalid bbox");
        return;
      }

      const b = `${minLat},${minLng},${maxLat},${maxLng}`;
      const query = `
[out:json][timeout:60];
(
  way["building"](${b});
  relation["building"](${b});
  way["natural"](${b});
  relation["natural"](${b});
  node["natural"](${b});
  way["landuse"](${b});
  relation["landuse"](${b});
  way["leisure"~"^(park|garden|nature_reserve|playground|golf_course|pitch)$"](${b});
  node["leisure"~"^(park|garden|nature_reserve|playground|golf_course|pitch)$"](${b});
  way["waterway"~"^(river|stream|canal|drain|ditch)$"](${b});
)
;
out geom tags;
      `.trim();

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ai2pb-map/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        res.status(response.status).send(`OSM upstream error ${response.status}`);
        return;
      }

      const data = await response.json();
      res.json({ elements: data.elements || [] });
    } catch (err) {
      res.status(500).send(err.message || "OSM proxy error");
    }
  });

  app.post("/api/analyze", async (req, res) => {
    const baseUrl = process.env.CONFIDENTIAL_MIND_BASE_URL;
    const apiKey  = process.env.CONFIDENTIAL_MIND_API_KEY;
    const model   = process.env.CONFIDENTIAL_MIND_MODEL || "gemma-3-27b-it";

    if (!baseUrl || !apiKey) {
      res.status(503).send("CONFIDENTIAL_MIND_BASE_URL and CONFIDENTIAL_MIND_API_KEY must be set");
      return;
    }

    try {
      const { summary } = req.body || {};
      if (!summary) {
        res.status(400).send("Missing summary");
        return;
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 16384,
          messages: [{
            role: "user",
            content: `You are a military terrain analyst. Produce a tactical terrain assessment using ONLY the data provided below. Use exactly these five sections. Each section: 3–5 bullet points, one sentence each, max 35 words per bullet.

MANDATORY RULES — violation makes the output useless:
- Every bullet MUST cite a specific named feature from the data: a road name, bridge name, settlement name, waterway name, or coordinate. No generalities.
- If a bridge is named, use its name. If a road is named, use its name. If a settlement is present, name it.
- Use coordinates (e.g. 60.1234°N 24.5678°E) when no name is available.
- Do NOT say "the area", "some bridges", "roads in the region", "elevated terrain" — point to the exact feature.
- No intro sentence, no conclusion, no filler. Start each section directly with bullets.
- If a section truly has no usable data, write one bullet: "Insufficient data."

## Logistics Chokepoints
Which specific bridges, road junctions, river crossings, or narrow corridors constrain movement? Name them and give their location.

## Logistics & Medical Support
Which named settlements or road segments enable resupply and casualty evacuation? Note road type and access constraints.

## Force Movement & Cover
Which named roads allow fast movement? Which forest areas, settlements, or elevation features (cite coordinates) provide cover from ground and air observation?

## Defensive Terrain
Which specific high points (coordinates), built-up areas, or river lines enable fortification, observation, or concealment from air/satellite/ELINT?

## Weather Impact
How will the specific forecast conditions affect mobility on named road types, visibility, air operations, and troop welfare over the coming days?

AREA DATA:
${summary}`,
          }],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        res.status(response.status).send(text || `Upstream error ${response.status}`);
        return;
      }

      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      const analysis = msg?.content || "No response from model.";
      res.json({ analysis, summary });
    } catch (err) {
      res.status(500).send(err.message || "Analysis error");
    }
  });

  // Serve built frontend (production)
  const distDir = path.resolve(__dirname, "..", "dist");
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  return app;
}
