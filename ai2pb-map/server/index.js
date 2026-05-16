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
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street|footway|cycleway|path|track)$"](${b});
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
