#!/usr/bin/env node
// server.mjs — Onchain Wire backend. Dependency-free Node http server.
//
//   node server.mjs            (PORT env var, default 3141)
//
// Serves the static Pi App (index.html, app.js, style.css, feed.json,
// privacy.html) and the Pi Platform server-side endpoints.
//
// PAYMENT ENDPOINTS ARE WORKING STUBS: they accept the real request shape,
// log it, and return the JSON the frontend expects — but they do NOT call
// the Pi Platform API yet. Search for "TODO(prod)" for the exact spots
// where the real calls go once the app's Server API Key exists.
//
// Real Pi payment flow (User-to-App), per Pi Docs:
//   1. Frontend: Pi.createPayment(...) → SDK gives a paymentId.
//   2. Frontend → POST /payments/approve { paymentId }
//      Backend → POST https://api.minepi.com/v2/payments/<paymentId>/approve
//                Header: Authorization: Key <PI_API_KEY>
//   3. User confirms in the Pi wallet sheet; a txid is created.
//   4. Frontend → POST /payments/complete { paymentId, txid }
//      Backend → POST https://api.minepi.com/v2/payments/<paymentId>/complete
//                Body: { txid }, same Authorization header.
//   The Server API Key must NEVER be exposed to the client.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3141', 10);
const PI_API_BASE = 'https://api.minepi.com/v2';
const PI_API_KEY = process.env.PI_API_KEY || ''; // from the Developer Portal app dashboard

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/* ------------------------- Pi Platform stubs ------------------------ */

// TODO(prod): verify the access token with the Pi Platform API:
//   GET https://api.minepi.com/v2/me   Header: Authorization: Bearer <accessToken>
// and return the platform's user object (uid, username). Until then this
// stub accepts any non-empty token and echoes the expected shape.
async function handleAuthVerify(req, res) {
  const { accessToken } = await readBody(req);
  if (!accessToken) return sendJSON(res, 400, { error: 'accessToken required' });
  log('[stub] /auth/verify called (token length ' + String(accessToken).length + ') — NOT verified against Pi Platform API');
  return sendJSON(res, 200, { ok: true, stub: true, verified: false });
}

// TODO(prod): before approving, GET /v2/payments/<paymentId> with
//   Authorization: Key <PI_API_KEY>
// and check amount/memo/metadata match what the app expects; then:
//   POST https://api.minepi.com/v2/payments/<paymentId>/approve
//   Authorization: Key <PI_API_KEY>
async function handleApprove(req, res) {
  const { paymentId } = await readBody(req);
  if (!paymentId) return sendJSON(res, 400, { error: 'paymentId required' });
  log(`[stub] /payments/approve paymentId=${paymentId} — would POST ${PI_API_BASE}/payments/${paymentId}/approve (Key ${PI_API_KEY ? 'set' : 'NOT SET'})`);
  return sendJSON(res, 200, { ok: true, stub: true, paymentId, approved: true });
}

// TODO(prod): submit the blockchain transaction id to Pi:
//   POST https://api.minepi.com/v2/payments/<paymentId>/complete
//   Authorization: Key <PI_API_KEY>   Body: { txid }
async function handleComplete(req, res) {
  const { paymentId, txid } = await readBody(req);
  if (!paymentId || !txid) return sendJSON(res, 400, { error: 'paymentId and txid required' });
  log(`[stub] /payments/complete paymentId=${paymentId} txid=${txid} — would POST ${PI_API_BASE}/payments/${paymentId}/complete`);
  return sendJSON(res, 200, { ok: true, stub: true, paymentId, txid, completed: true });
}

/* ---------------------------- Static files -------------------------- */

async function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { // path traversal guard
    res.writeHead(403); return res.end('Forbidden');
  }
  try {
    const data = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

/* ------------------------------- Router ----------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'POST' && url.pathname === '/payments/approve') return await handleApprove(req, res);
    if (req.method === 'POST' && url.pathname === '/payments/complete') return await handleComplete(req, res);
    if (req.method === 'POST' && url.pathname === '/auth/verify') return await handleAuthVerify(req, res);
    if (req.method === 'GET' && url.pathname === '/healthz') return sendJSON(res, 200, { ok: true, app: 'onchain-wire' });
    if (req.method === 'GET') return await serveStatic(req, res, url.pathname);
    res.writeHead(405); res.end('Method not allowed');
  } catch (err) {
    log('request error:', err.message);
    sendJSON(res, 400, { error: err.message });
  }
});

server.listen(PORT, () => {
  log(`Onchain Wire server listening on http://localhost:${PORT} (root: ${ROOT})`);
  log(`PI_API_KEY ${PI_API_KEY ? 'is set' : 'is NOT set — payment endpoints run as stubs (expected for this build)'}`);
});
