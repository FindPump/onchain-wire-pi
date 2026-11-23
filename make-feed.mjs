#!/usr/bin/env node
// make-feed.mjs — regenerate feed.json from the Onchain Wire news pipeline.
//
// Reads the newest edition files (edisi-YYYY-MM-DD-<slot>.txt) from the
// berita-x workspace and converts each edition into one feed item:
//   { id, title, summary, body[], source, category, edition, publishedAt }
//
// Usage:
//   node make-feed.mjs [--limit 10] [--dir /path/to/berita-x]
//
// Default source dir: ../../berita-x relative to this script
// (override with --dir or the BERITA_DIR env var). Output: ./feed.json
// next to this script. Run it after each new edition is published so the
// app always shows fresh, verified news.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
function argVal(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const LIMIT = parseInt(argVal('--limit', '10'), 10);
const BERITA_DIR = argVal('--dir', process.env.BERITA_DIR || path.resolve(here, '../../berita-x'));

// Chronological order of the five daily slots (WIB).
const SLOT_ORDER = { pagi: 0, sela: 1, siang: 2, sore: 3, malam: 4 };
const SLOT_TIME = { pagi: '07:30', sela: '10:30', siang: '13:30', sore: '16:30', malam: '20:30' };
const SLOT_LABEL = { pagi: 'Morning', sela: 'Midday', siang: 'Afternoon', sore: 'Evening', malam: 'Night' };
const CATEGORY_LABEL = {
  CRYPTO: 'Crypto',
  WAR: 'War',
  INTERNASIONAL: 'International',
  EKONOMI: 'Economy',
  POLITIK: 'Politics',
};
const ID_MONTHS = {
  Januari: '01', Februari: '02', Maret: '03', April: '04', Mei: '05', Juni: '06',
  Juli: '07', Agustus: '08', September: '09', Oktober: '10', November: '11', Desember: '12',
};

function cleanText(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function firstSentence(text, maxLen = 130) {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  let s = m ? m[0] : text;
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + '…';
  return s;
}

function parseTimestamp(headerLine, fileDate, slot) {
  // Format A: "EDISI MALAM — 2026-11-23 20:30 WIB"
  let m = headerLine.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+07:00`;
  // Format B: "EDISI PAGI — Senin, 23 November 2026, 07:30 WIB"
  m = headerLine.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),?\s+(\d{2}):(\d{2})/);
  if (m && ID_MONTHS[m[2]]) {
    const dd = m[1].padStart(2, '0');
    return `${m[3]}-${ID_MONTHS[m[2]]}-${dd}T${m[4]}:${m[5]}:00+07:00`;
  }
  // Fallback: filename date + the slot's fixed publish time.
  return `${fileDate}T${SLOT_TIME[slot] || '07:30'}:00+07:00`;
}

// The pipeline has used several layouts since 21 Nov 2026. This parser
// handles all of them:
//   - category from "Topik: WAR — <english headline>" / "Topik: CRYPTO (...)"
//     or from a pipe segment on the EDISI header line ("... | CRYPTO | ...")
//   - source credit from "Sumber terverifikasi:" / "Sumber verifikasi:"
//     (header or file end) or the short "Sumber:" header line
//   - thread posts split by "--- 1/4 ---", "1/", or "1/3:" marker lines,
//     with trailing " 1/4" / "🧵 1/3" markers stripped from post text
//   - meta lines (Format:, Visual:, Kartu:, Intro (ID):, Cerita:) and the
//     trailing "Catatan..." editorial block are excluded from the body
const META_LINE = /^(EDISI\b|Topik:|Format:|Visual:|Kartu:|Intro \(ID\):|Cerita:|Sumber:|Sumber terverifikasi:|Sumber verifikasi:)/;
const POST_MARKER = /^(?:--- \d+\/\d+ ---|\d+\/\d+:?|\d+\/)\s*$/m;

function parseEdition(raw, fileName) {
  const fm = fileName.match(/^edisi-(\d{4}-\d{2}-\d{2})-([a-z]+)\.txt$/);
  const fileDate = fm[1];
  const slot = fm[2];

  const lines = raw.split(/\r?\n/);
  const headerLine = lines[0] || '';

  // --- Category + optional headline from the Topik line -----------------
  let categoryRaw = '';
  let topicHeadline = '';
  for (const line of lines) {
    const t = line.match(/^Topik:\s*(.+)$/);
    if (t) {
      const val = t[1].trim();
      categoryRaw = val.split(/\s*[|(]/)[0].split(/\s+—\s+/)[0].trim().toUpperCase();
      // "Topik: WAR — Iran strikes US bases..." — suffix is an English
      // headline, but only when the category part is a bare caps word
      // (parenthesised Topik notes are Indonesian working notes, not titles).
      const dash = val.match(/^[A-Z ]+—\s*(.+)$/);
      if (dash && !val.includes('(')) topicHeadline = dash[1].trim();
      break;
    }
  }
  if (!categoryRaw) {
    // Pipe-format header: "EDISI MALAM — 2026-11-22 20:30 WIB | CRYPTO | ..."
    const seg = headerLine.split('|').map((s) => s.trim().toUpperCase())
      .find((s) => CATEGORY_LABEL[s]);
    if (seg) categoryRaw = seg;
  }

  // --- Source credit (long form anywhere wins over the short form) ------
  let source = '';
  let shortSource = '';
  for (const line of lines) {
    const long = line.match(/^Sumber (?:terverifikasi|verifikasi):\s*(.+)$/);
    if (long && !source) source = long[1];
    const short = line.match(/^Sumber:\s*(.+)$/);
    if (short && !shortSource) shortSource = short[1];
  }
  source = cleanText(source || shortSource).replace(/\.$/, '').split(/\.?\s*Fakta inti\b/)[0].trim();

  // --- Body: drop meta lines and the trailing Catatan block -------------
  const bodyLines = [];
  for (const line of lines) {
    if (/^Catatan\b/.test(line)) break; // editorial notes run to end of file
    if (META_LINE.test(line)) continue;
    bodyLines.push(line);
  }
  const bodyText = bodyLines.join('\n').trim();

  // --- Split into thread posts and clean each one ------------------------
  let posts = POST_MARKER.test(bodyText) ? bodyText.split(POST_MARKER) : [bodyText];
  posts = posts
    .map((p) => cleanText(p).replace(/\s*(?:🧵\s*)?\d+\/\d+\s*$/, '').trim())
    .filter(Boolean);
  if (posts.length === 0) return null;

  const title = topicHeadline || firstSentence(posts[0]);
  const summary = posts[0].length > 240 ? posts[0].slice(0, 239).trimEnd() + '…' : posts[0];

  return {
    id: fileName.replace(/\.txt$/, ''),
    title,
    summary,
    body: posts,
    source: source || 'Onchain Wire verified sources',
    category: CATEGORY_LABEL[categoryRaw] || (categoryRaw ? categoryRaw.charAt(0) + categoryRaw.slice(1).toLowerCase() : 'News'),
    categoryRaw,
    edition: SLOT_LABEL[slot] || slot,
    publishedAt: parseTimestamp(headerLine, fileDate, slot),
  };
}

const files = (await readdir(BERITA_DIR))
  .filter((f) => /^edisi-\d{4}-\d{2}-\d{2}-[a-z]+\.txt$/.test(f))
  .sort((a, b) => {
    const da = a.slice(6, 16), db = b.slice(6, 16);
    if (da !== db) return db.localeCompare(da); // newest date first
    const sa = SLOT_ORDER[a.match(/-([a-z]+)\.txt$/)[1]] ?? 0;
    const sb = SLOT_ORDER[b.match(/-([a-z]+)\.txt$/)[1]] ?? 0;
    return sb - sa; // latest slot first
  })
  .slice(0, LIMIT);

if (files.length === 0) {
  console.error(`No edition files found in ${BERITA_DIR}`);
  process.exit(1);
}

const items = [];
for (const f of files) {
  const raw = await readFile(path.join(BERITA_DIR, f), 'utf8');
  const item = parseEdition(raw, f);
  if (item) items.push(item);
}

const feed = {
  generatedAt: new Date().toISOString(),
  source: 'Onchain Wire — verified crypto & world news (@xdropseeker). Every story is checked against at least two trusted outlets before publication.',
  items,
};

const out = path.join(here, 'feed.json');
await writeFile(out, JSON.stringify(feed, null, 2) + '\n', 'utf8');
console.log(`Wrote ${out} with ${items.length} items (newest: ${items[0]?.id || 'none'})`);
