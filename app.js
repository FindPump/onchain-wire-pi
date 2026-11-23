/* Onchain Wire — Pi App frontend logic.
 *
 * Pi SDK integration (per Pi Docs, SdkReference):
 *   - Pi.init({ version: "2.0", sandbox }) once, after the SDK script loads.
 *   - Pi.authenticate(scopes, onIncompletePaymentFound) on user action.
 *   - Pi.createPayment(paymentData, callbacks) for User-to-App payments;
 *     the callbacks MUST round-trip through our backend
 *     (/payments/approve and /payments/complete) — see server.mjs.
 *
 * Outside Pi Browser the SDK object is absent (or authenticate fails):
 * the app then runs in demo mode — the full news feed stays readable and
 * only Pi sign-in / payments are disabled, with an explanatory banner.
 */

'use strict';

/* ============================== CONFIG ============================== */
const CONFIG = {
  // Pi sandbox mode: true while developing against the sandbox / Testnet.
  // Set to false for the Mainnet-bound production build. This single flag
  // is the "configurable sandbox" switch for Pi.init.
  sandbox: true,
  scopes: ['username', 'payments'],
  supportAmount: 0.1, // Pi — TEST support payment (see index.html note)
  supportMemo: 'Support Onchain Wire (test payment)',
};

/* ============================== STATE =============================== */
let piUser = null;        // { username, uid } after authenticate
let feedItems = [];
let activeCategory = 'All';

const $ = (id) => document.getElementById(id);

/* ============================ UI HELPERS ============================ */
function showStatus(msg) {
  const b = $('status-banner');
  if (!msg) { b.hidden = true; b.textContent = ''; return; }
  b.textContent = msg;
  b.hidden = false;
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

/* ============================== FEED ================================ */
async function loadFeed() {
  try {
    const res = await fetch('feed.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('feed ' + res.status);
    const feed = await res.json();
    feedItems = Array.isArray(feed.items) ? feed.items : [];
    $('feed-meta').textContent =
      `${feedItems.length} verified stories · updated ${fmtTime(feed.generatedAt)} · sources checked twice before publication`;
    buildFilters();
    renderList();
  } catch (err) {
    $('feed-meta').textContent = 'Could not load the news feed. Please try again later.';
    console.error('feed load failed', err);
  }
}

function buildFilters() {
  const cats = ['All', ...new Set(feedItems.map((i) => i.category))];
  const nav = $('filters');
  nav.innerHTML = '';
  for (const c of cats) {
    const b = el('button', 'chip' + (c === activeCategory ? ' active' : ''), c);
    b.type = 'button';
    b.addEventListener('click', () => {
      activeCategory = c;
      nav.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x.textContent === c));
      renderList();
    });
    nav.appendChild(b);
  }
}

function renderList() {
  const wrap = $('cards');
  wrap.innerHTML = '';
  const items = feedItems.filter((i) => activeCategory === 'All' || i.category === activeCategory);
  $('feed-empty').hidden = items.length > 0;
  for (const item of items) {
    const card = el('button', 'card');
    card.type = 'button';
    const row = el('div', 'row');
    row.appendChild(el('span', 'badge', item.category));
    row.appendChild(el('time', null, `${item.edition} edition · ${fmtTime(item.publishedAt)}`));
    card.appendChild(row);
    card.appendChild(el('h3', null, item.title));
    card.appendChild(el('p', null, item.summary));
    card.addEventListener('click', () => openArticle(item));
    wrap.appendChild(card);
  }
}

function openArticle(item) {
  $('art-category').textContent = item.category;
  $('art-time').textContent = `${item.edition} edition · ${fmtTime(item.publishedAt)}`;
  $('art-title').textContent = item.title;
  const body = $('art-body');
  body.innerHTML = '';
  for (const para of item.body) body.appendChild(el('p', null, para));
  $('art-source').textContent = item.source;
  $('view-list').hidden = true;
  $('view-article').hidden = false;
  window.scrollTo({ top: 0 });
}

/* ============================ PI: AUTH ============================== */
// Called by the SDK if a previous payment was left incomplete.
function onIncompletePaymentFound(payment) {
  console.warn('Incomplete payment found:', payment && payment.identifier);
  showStatus('An earlier payment was left incomplete. It must be completed or it will expire — see BUILD-NOTES.md.');
  // TODO(production): POST the incomplete payment to /payments/complete
  // (with its txid) or let it expire, per Pi platform guidance.
}

async function initPi() {
  if (!window.Pi) {
    enterDemoMode('Pi SDK not detected.');
    return;
  }
  try {
    window.Pi.init({ version: '2.0', sandbox: CONFIG.sandbox });
  } catch (err) {
    enterDemoMode('Pi.init failed.');
    console.error(err);
    return;
  }
  $('btn-signin').addEventListener('click', signIn);
  $('btn-support').addEventListener('click', supportPayment);
}

function enterDemoMode(reason) {
  console.info('Demo mode:', reason);
  $('demo-banner').hidden = false;
  const signin = $('btn-signin');
  signin.disabled = true;
  signin.textContent = 'Sign in with Pi (Pi Browser only)';
  $('btn-support').addEventListener('click', () => {
    showStatus('Pi payments need the real app inside Pi Browser — this browser is in demo mode.');
  });
}

async function signIn() {
  const btn = $('btn-signin');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const auth = await window.Pi.authenticate(CONFIG.scopes, onIncompletePaymentFound);
    piUser = auth.user;
    // NOTE: auth.accessToken should be verified server-side via the Pi
    // Platform API (GET https://api.minepi.com/v2/me) before trusting it.
    // server.mjs exposes a stub POST /auth/verify for exactly that step.
    fetch('/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: auth.accessToken }),
    }).catch(() => { /* stub/offline — non-fatal in this build */ });

    btn.hidden = true;
    const chip = $('user-chip');
    chip.textContent = '@' + piUser.username;
    chip.hidden = false;
    showStatus(`Signed in as @${piUser.username}. Welcome to Onchain Wire.`);
  } catch (err) {
    console.error('authenticate failed', err);
    btn.disabled = false;
    btn.textContent = 'Sign in with Pi';
    showStatus('Sign-in did not complete. If you are not in Pi Browser, the app stays in demo mode.');
  }
}

/* ========================== PI: PAYMENTS ============================ */
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function supportPayment() {
  if (!window.Pi) return; // demo-mode handler already bound
  if (!piUser) {
    showStatus('Please sign in with Pi first, then tap Support.');
    return;
  }
  showStatus('Opening the Pi payment sheet (test payment)…');
  const paymentData = {
    amount: CONFIG.supportAmount,
    memo: CONFIG.supportMemo,
    metadata: { app: 'onchain-wire', purpose: 'supporter-tip', test: true },
  };
  const callbacks = {
    onReadyForServerApproval: async (paymentId) => {
      try {
        await postJSON('/payments/approve', { paymentId });
        showStatus('Payment approved by the server — waiting for the blockchain step…');
      } catch (err) {
        console.error('approve failed', err);
        showStatus('Server approval failed. The payment cannot continue.');
      }
    },
    onReadyForServerCompletion: async (paymentId, txid) => {
      try {
        await postJSON('/payments/complete', { paymentId, txid });
        showStatus('Thank you! Your test support payment completed. (Stub backend — no real Pi moved.)');
      } catch (err) {
        console.error('complete failed', err);
        showStatus('Server completion failed — the payment may stay incomplete.');
      }
    },
    onCancel: () => showStatus('Payment cancelled.'),
    onError: (err) => {
      console.error('payment error', err);
      showStatus('Payment error: ' + (err && err.message ? err.message : 'unknown error'));
    },
  };
  try {
    window.Pi.createPayment(paymentData, callbacks);
  } catch (err) {
    console.error('createPayment failed', err);
    showStatus('Could not start the payment. Are you inside Pi Browser and signed in?');
  }
}

/* ============================== BOOT ================================ */
document.addEventListener('DOMContentLoaded', () => {
  $('btn-back').addEventListener('click', () => {
    $('view-article').hidden = true;
    $('view-list').hidden = false;
    window.scrollTo({ top: 0 });
  });
  loadFeed();
  initPi();
});
