import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5174;

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
        "relative_humidity_2m",
      ].join(",")
    );
    url.searchParams.set("forecast_days", "2");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString());
    if (!response.ok) {
      res.status(response.status).send(`Weather upstream error ${response.status}`);
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).send(err.message || "Weather proxy error");
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
    // content = actual answer, reasoning = chain-of-thought (model separates them)
    const analysis = msg?.content || "No response from model.";
    res.json({ analysis, summary });
  } catch (err) {
    res.status(500).send(err.message || "Analysis error");
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
