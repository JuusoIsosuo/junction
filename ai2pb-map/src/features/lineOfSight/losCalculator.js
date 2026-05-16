// ── Geometry helpers ────────────────────────────────────────────────

function cross2D(ax, ay, bx, by) { return ax * by - ay * bx; }

// Returns t in (0,1) where ray (ax,ay)→(bx,by) first crosses a polygon ring edge.
// Returns -1 if no crossing.
function rayRingFirstT(ax, ay, bx, by, ring) {
  const rx = bx - ax, ry = by - ay;
  let minT = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const cx = ring[i][0], cy = ring[i][1];
    const sx = ring[i + 1][0] - cx, sy = ring[i + 1][1] - cy;
    const denom = cross2D(rx, ry, sx, sy);
    if (Math.abs(denom) < 1e-14) continue;
    const qx = cx - ax, qy = cy - ay;
    const t = cross2D(qx, qy, sx, sy) / denom;
    const u = cross2D(qx, qy, rx, ry) / denom;
    if (t > 0.01 && t < 0.99 && u >= 0 && u <= 1 && t < minT) minT = t;
  }
  return minT === Infinity ? -1 : minT;
}

// Count how many times a ray passes through a polygon ring (for forest density)
function rayRingCrossings(ax, ay, bx, by, ring) {
  const rx = bx - ax, ry = by - ay;
  let count = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const cx = ring[i][0], cy = ring[i][1];
    const sx = ring[i + 1][0] - cx, sy = ring[i + 1][1] - cy;
    const denom = cross2D(rx, ry, sx, sy);
    if (Math.abs(denom) < 1e-14) continue;
    const qx = cx - ax, qy = cy - ay;
    const t = cross2D(qx, qy, sx, sy) / denom;
    const u = cross2D(qx, qy, rx, ry) / denom;
    if (t > 0.01 && t < 0.99 && u >= 0 && u <= 1) count++;
  }
  return count;
}

function bboxOverlapsSegment({ minX, maxX, minY, maxY }, ax, ay, bx, by) {
  return !(Math.max(ax, bx) < minX || Math.min(ax, bx) > maxX ||
           Math.max(ay, by) < minY || Math.min(ay, by) > maxY);
}

// ── Elevation interpolation ─────────────────────────────────────────

function interpolateElev(lng, lat, elevResults, bbox) {
  const N = 10;
  const col = Math.max(0, Math.min(N - 1, ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * (N - 1)));
  const row = Math.max(0, Math.min(N - 1, ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * (N - 1)));
  const c0 = Math.min(N - 2, Math.floor(col)), r0 = Math.min(N - 2, Math.floor(row));
  const fc = col - c0, fr = row - r0;
  const e = (r, c) => elevResults[r * N + c].elevation;
  return e(r0, c0) * (1 - fc) * (1 - fr) + e(r0, c0 + 1) * fc * (1 - fr) +
         e(r0 + 1, c0) * (1 - fc) * fr   + e(r0 + 1, c0 + 1) * fc * fr;
}

// ── Obstacle extraction ─────────────────────────────────────────────
// NOTE: osmLayer.js stores feature type as _featureType (with underscore)

export function extractObstacles(osmGeoJSON) {
  const buildings = [], forests = [];
  for (const f of osmGeoJSON?.features ?? []) {
    if (f.geometry?.type !== 'Polygon') continue;
    const ring = f.geometry.coordinates[0];
    if (!ring || ring.length < 3) continue;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }

    const ftype = f.properties?._featureType;
    const hasBuilding = ftype === 'buildings' || !!f.properties?.building;
    const hasForest = ftype === 'natural_wood' || ftype === 'landuse_forest' ||
                      f.properties?.natural === 'wood' || f.properties?.landuse === 'forest';

    const height = parseFloat(f.properties?.height ?? 0) ||
                   (parseInt(f.properties?.['building:levels'] ?? 0, 10) * 3) || 8;
    const entry = { ring, minX, maxX, minY, maxY, height };

    if (hasBuilding) buildings.push(entry);
    else if (hasForest) forests.push(entry);
  }
  return { buildings, forests };
}

// ── Core LoS computation ────────────────────────────────────────────

export function computeLoS({ observerLng, observerLat, bbox, elevResults, buildings, forests }) {
  const COLS = 160, ROWS = 160;
  const ELEV_SAMPLES = 30;
  const EYE_HEIGHT = 1.8;   // m — added at BOTH ends for a symmetric ray
  const ELEV_TOLERANCE = 3; // m — accounts for DEM inaccuracy at 1km resolution

  const obsGround = interpolateElev(observerLng, observerLat, elevResults, bbox);
  const obsElev = obsGround + EYE_HEIGHT;

  const results = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const lng = bbox.minLng + (col + 0.5) / COLS * (bbox.maxLng - bbox.minLng);
      const lat = bbox.minLat + (row + 0.5) / ROWS * (bbox.maxLat - bbox.minLat);

      // Eye height added at target too → symmetric ray
      const tgtElev = interpolateElev(lng, lat, elevResults, bbox) + EYE_HEIGHT;

      // ── Building blocking ──────────────────────────────────────
      let buildingBlocked = false;
      for (const b of buildings) {
        if (!bboxOverlapsSegment(b, observerLng, observerLat, lng, lat)) continue;
        const t = rayRingFirstT(observerLng, observerLat, lng, lat, b.ring);
        if (t < 0) continue;
        const bLng = observerLng + (lng - observerLng) * t;
        const bLat = observerLat + (lat - observerLat) * t;
        const groundAtB = interpolateElev(bLng, bLat, elevResults, bbox);
        const buildingTop = groundAtB + b.height;
        const rayH = obsElev + (tgtElev - obsElev) * t;
        if (buildingTop > rayH) { buildingBlocked = true; break; }
      }
      if (buildingBlocked) { results.push({ score: 0, row, col }); continue; }

      // ── Terrain blocking ───────────────────────────────────────
      let elevBlocked = false;
      for (let s = 1; s < ELEV_SAMPLES - 1; s++) {
        const t = s / (ELEV_SAMPLES - 1);
        const sLng = observerLng + (lng - observerLng) * t;
        const sLat = observerLat + (lat - observerLat) * t;
        const terrain = interpolateElev(sLng, sLat, elevResults, bbox);
        const rayH = obsElev + (tgtElev - obsElev) * t;
        // terrain must be clearly higher than the ray to count as blocked
        if (terrain > rayH + ELEV_TOLERANCE) { elevBlocked = true; break; }
      }
      if (elevBlocked) { results.push({ score: 0, row, col }); continue; }

      // ── Forest partial blocking ────────────────────────────────
      let forestAreas = 0;
      for (const f of forests) {
        if (!bboxOverlapsSegment(f, observerLng, observerLat, lng, lat)) continue;
        // Each enter+exit pair = one forest area crossed
        const crossings = rayRingCrossings(observerLng, observerLat, lng, lat, f.ring);
        if (crossings > 0) forestAreas++;
      }
      const score = forestAreas === 0 ? 1 : Math.max(0.05, 1 - forestAreas * 0.4);
      results.push({ score, row, col });
    }
  }

  return { results, gridCols: COLS, gridRows: ROWS };
}

// ── Canvas rendering ────────────────────────────────────────────────

function scoreToRgba(score) {
  if (score >= 0.85) return [34, 197, 94, 150];
  if (score >= 0.55) return [163, 230, 53, 150];
  if (score >= 0.30) return [234, 179, 8, 155];
  if (score >= 0.10) return [249, 115, 22, 160];
  return [239, 68, 68, 175];
}

function boxBlur(data, cols, rows, radius) {
  const out = new Float32Array(data.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0, cnt = 0;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r2 = row + dr, c2 = col + dc;
          if (r2 >= 0 && r2 < rows && c2 >= 0 && c2 < cols) {
            sum += data[r2 * cols + c2]; cnt++;
          }
        }
      }
      out[row * cols + col] = sum / cnt;
    }
  }
  return out;
}

export function losResultsToCanvas(results, gridCols, gridRows) {
  const SCALE = 3;
  const canvas = document.createElement('canvas');
  canvas.width  = gridCols * SCALE;
  canvas.height = gridRows * SCALE;
  const ctx = canvas.getContext('2d');

  const rawScores = new Float32Array(gridRows * gridCols);
  for (const r of results) rawScores[r.row * gridCols + r.col] = r.score;
  const smoothed = boxBlur(rawScores, gridCols, gridRows, 1);

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const px = imgData.data;

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const [r, g, b, a] = scoreToRgba(smoothed[row * gridCols + col]);
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          const pxRow = (gridRows - 1 - row) * SCALE + sy;
          const pxCol = col * SCALE + sx;
          const idx = (pxRow * canvas.width + pxCol) * 4;
          px[idx] = r; px[idx+1] = g; px[idx+2] = b; px[idx+3] = a;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
