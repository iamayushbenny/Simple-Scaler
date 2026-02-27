/**
 * InfraSizer Pro — Config Backend
 *
 * Lightweight Express server that centralises ALL admin configuration
 * in JSON files so every user (sales, admin) sees the same data.
 *
 * Endpoints:
 *   GET  /api/config      → read  config/platformRecommendations.json
 *   POST /api/config      → write config/platformRecommendations.json
 *   GET  /api/calcconfig   → read  config/calculationConfig.json
 *   POST /api/calcconfig   → write config/calculationConfig.json
 *
 * No database required — uses fs for file I/O with atomic writes.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env (optional)
try { require('dotenv').config(); } catch (_) { /* dotenv not installed — fine */ }

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Paths to JSON config files ────────────────────────────────────────────
const PLATFORM_CONFIG_PATH = path.join(__dirname, 'config', 'platformRecommendations.json');
const CALC_CONFIG_PATH = path.join(__dirname, 'config', 'calculationConfig.json');

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Atomic write: write to .tmp then rename to prevent corruption */
function atomicWriteJSON(filePath, data) {
  const tempPath = filePath + '.tmp';
  const formatted = JSON.stringify(data, null, 2);
  fs.writeFileSync(tempPath, formatted, 'utf-8');
  fs.renameSync(tempPath, filePath);
  return formatted.length;
}

/** Read and parse a JSON file */
function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── GET /api/config ─ read platform recommendations ───────────────────────
app.get('/api/config', (_req, res) => {
  try {
    if (!fs.existsSync(PLATFORM_CONFIG_PATH)) {
      return res.status(404).json({ error: 'Platform config file not found.' });
    }
    return res.json(readJSON(PLATFORM_CONFIG_PATH));
  } catch (err) {
    console.error('[GET /api/config] Error:', err.message);
    return res.status(500).json({ error: 'Failed to read platform config.' });
  }
});

// ─── POST /api/config ─ overwrite platform recommendations ────────────────
app.post('/api/config', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object.' });
    }
    if (!Array.isArray(data.software) || !Array.isArray(data.browsers)) {
      return res.status(400).json({
        error: 'Payload must contain "software" (array) and "browsers" (array).',
      });
    }

    const bytes = atomicWriteJSON(PLATFORM_CONFIG_PATH, data);
    console.log(`[POST /api/config] Platform config updated (${bytes} bytes)`);
    return res.json({ success: true, message: 'Platform config saved.' });
  } catch (err) {
    console.error('[POST /api/config] Error:', err.message);
    try { fs.unlinkSync(PLATFORM_CONFIG_PATH + '.tmp'); } catch (_) { /* ignore */ }
    return res.status(500).json({ error: 'Failed to save platform config.' });
  }
});

// ─── GET /api/calcconfig ─ read calculation config ─────────────────────────
app.get('/api/calcconfig', (_req, res) => {
  try {
    if (!fs.existsSync(CALC_CONFIG_PATH)) {
      return res.status(404).json({ error: 'Calculation config file not found.' });
    }
    return res.json(readJSON(CALC_CONFIG_PATH));
  } catch (err) {
    console.error('[GET /api/calcconfig] Error:', err.message);
    return res.status(500).json({ error: 'Failed to read calculation config.' });
  }
});

// ─── POST /api/calcconfig ─ overwrite calculation config ───────────────────
app.post('/api/calcconfig', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object.' });
    }
    // Minimal validation: must have envMultipliers at the very least
    if (!data.envMultipliers || typeof data.envMultipliers !== 'object') {
      return res.status(400).json({
        error: 'Payload must contain "envMultipliers" object.',
      });
    }

    const bytes = atomicWriteJSON(CALC_CONFIG_PATH, data);
    console.log(`[POST /api/calcconfig] Calculation config updated (${bytes} bytes)`);
    return res.json({ success: true, message: 'Calculation config saved.' });
  } catch (err) {
    console.error('[POST /api/calcconfig] Error:', err.message);
    try { fs.unlinkSync(CALC_CONFIG_PATH + '.tmp'); } catch (_) { /* ignore */ }
    return res.status(500).json({ error: 'Failed to save calculation config.' });
  }
});

// ─── 404 catch-all ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ─── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ✓ InfraSizer Pro config backend running on port ${PORT}`);
  console.log(`    GET  http://localhost:${PORT}/api/config       (platform recommendations)`);
  console.log(`    POST http://localhost:${PORT}/api/config`);
  console.log(`    GET  http://localhost:${PORT}/api/calcconfig   (calculation config)`);
  console.log(`    POST http://localhost:${PORT}/api/calcconfig\n`);
});
