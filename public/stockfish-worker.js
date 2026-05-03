// =====================================
// Phoenix CORE++ Stockfish Cluster (v11.1 STABLE)
// Multi-engine pool • Race-safe • Load-balanced • PV-safe
// =====================================

const MAX_ENGINES = 2;
const MAX_PV = 5;
const CACHE_TTL_MS = 15000;

const ENGINE_STATE = {
  INIT: 0,
  LOADING: 1,
  UCI: 2,
  WAIT_READY: 3,
  READY: 4,
  BUSY: 5,
  DEAD: 6
};

const slots = [];
let session = 0;
let currentRequest = null;
let watchdogTimer = null;

const resultCache = new Map();
const pvMap = new Map();

const now = () => Date.now();
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

// ================= CACHE =================
function cacheKey(fen, depth, mpv) {
  return `${fen}||${depth}||${mpv}`;
}

function getCache(key) {
  const item = resultCache.get(key);
  if (!item) return null;

  if (now() - item.at > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return item.moves;
}

function putCache(key, moves) {
  if (!moves?.length) return;

  resultCache.set(key, { at: now(), moves: [...moves] });

  if (resultCache.size > 64) {
    resultCache.delete(resultCache.keys().next().value);
  }
}

// ================= SLOT =================
function makeSlot(index) {
  return {
    index,
    worker: null,
    state: ENGINE_STATE.INIT,
    spawnId: 0,
    job: null,
    lastTick: 0,
    lastSearchTick: 0
  };
}

// ================= ENGINE =================
function createEngineWorker() {
  const sources = [
    "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js",
    "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-16-single.js",
    "https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16-single.js"
  ];

  let worker = null;

  for (const src of sources) {
    try {
      importScripts(src);

      worker =
        typeof STOCKFISH !== "undefined"
          ? STOCKFISH()
          : typeof Stockfish !== "undefined"
          ? Stockfish()
          : null;

      if (worker) break;
    } catch {}
  }

  return worker;
}

// ================= CLEAN =================
function disposeWorker(slot) {
  if (!slot.worker) return;

  try {
    slot.worker.onmessage = null;
    slot.worker.onerror = null;
    slot.worker.postMessage("stop");
    slot.worker.terminate?.();
  } catch {}

  slot.worker = null;
}

// ================= SPAWN =================
function spawnSlot(index) {
  const slot = slots[index];
  if (!slot) return;

  disposeWorker(slot);

  const worker = createEngineWorker();
  if (!worker) return;

  const gen = ++slot.spawnId;

  slot.worker = worker;
  slot.state = ENGINE_STATE.LOADING;

  worker.onmessage = (e) => {
    if (slot.spawnId !== gen) return;
    onEngineMsg(index, typeof e === "string" ? e : e.data);
  };

  worker.onerror = () => {
    if (slot.spawnId !== gen) return;
    markDead(index);
  };

  slot.state = ENGINE_STATE.UCI;
  worker.postMessage("uci");

  setTimeout(() => {
    if (slot.spawnId === gen && slot.state === ENGINE_STATE.UCI) {
      markDead(index);
    }
  }, 8000);
}

// ================= STATE =================
function markReady(i) {
  const s = slots[i];
  if (!s) return;
  s.state = ENGINE_STATE.READY;
}

function markDead(i) {
  const s = slots[i];
  if (!s) return;

  s.state = ENGINE_STATE.DEAD;
  s.job = null;
  disposeWorker(s);

  setTimeout(() => spawnSlot(i), 800);
}

// ================= ENGINE PICK (FIXED LOAD BALANCE) =================
function getEngine() {
  let best = -1;
  let minLoad = Infinity;

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];

    if (s?.state === ENGINE_STATE.READY && !s.job) {
      const load = s.lastSearchTick || 0;

      if (load < minLoad) {
        minLoad = load;
        best = i;
      }
    }
  }

  return best;
}

// ================= SEARCH =================
function startSearch(fen, depth, mpv) {
  session++;
  const mySession = session;

  const req = {
    session: mySession,
    fen,
    depth,
    mpv: clamp(mpv || 1, 1, MAX_PV),
    done: false,
    id: Math.random()
  };

  currentRequest = req;

  pvMap.clear();

  const cached = getCache(cacheKey(fen, depth, req.mpv));
  if (cached) {
    self.postMessage({ type: "result", moves: cached });
    return;
  }

  const id = getEngine();
  if (id === -1) {
    self.postMessage({ type: "result", moves: [] });
    return;
  }

  const s = slots[id];
  s.job = req;
  s.state = ENGINE_STATE.BUSY;

  s.lastSearchTick = now(); // 🔥 FIX

  try {
    s.worker.postMessage("stop");
    s.worker.postMessage("ucinewgame");
    s.worker.postMessage(`setoption name MultiPV value ${req.mpv}`);
    s.worker.postMessage(`position fen ${fen}`);
    s.worker.postMessage(`go depth ${depth}`);
  } catch {}

  setTimeout(() => {
    if (req.session === session && !req.done) {
      finish(req, []);
    }
  }, Math.min(15000, 2000 + depth * 700));
}

// ================= FINISH =================
function finish(req, moves) {
  if (!req || req.done || req.session !== session || req !== currentRequest) return;

  req.done = true;

  if (moves?.length) {
    putCache(cacheKey(req.fen, req.depth, req.mpv), moves);
  }

  self.postMessage({ type: "result", moves });
}

// ================= ENGINE MSG =================
function onEngineMsg(i, line) {
  const s = slots[i];
  if (!s?.worker || !line) return;

  s.lastTick = now();

  if (line === "uciok") {
    s.worker.postMessage("isready");
    return;
  }

  if (line === "readyok") {
    markReady(i);
    return;
  }

  if (s.state !== ENGINE_STATE.BUSY) return;

  // ================= PV SAFE PARSE =================
  if (line.startsWith("info") && line.includes(" pv ")) {
    const idx = line.indexOf(" pv ");
    if (idx === -1) return;

    const pv = line.slice(idx + 4).trim().split(/\s+/);
    if (!pv.length) return;

    const mpv = line.match(/multipv (\d+)/);
    const depth = line.match(/depth (\d+)/);
    const cp = line.match(/score cp (-?\d+)/);
    const mate = line.match(/score mate (-?\d+)/);

    const id = mpv?.[1] ? +mpv[1] : 1;
    const d = depth ? +depth[1] : 0;

    const prev = pvMap.get(id);

    if (!prev || d >= prev.depth) {
      pvMap.set(id, {
        move: pv[0],
        depth: d,
        score: mate ? 999999 : (cp ? +cp[1] : 0)
      });
    }
  }

  if (line.startsWith("bestmove")) {
    s.state = ENGINE_STATE.READY;
    s.job = null;

    const best = line.split(" ")[1];

    const moves = [...pvMap.values()]
      .sort((a, b) => b.depth - a.depth)
      .map(v => v.move)
      .filter(Boolean);

    finish(currentRequest, moves.length ? moves : [best]);

    pvMap.clear();
  }
}

// ================= WATCHDOG =================
function startWatchdog() {
  clearInterval(watchdogTimer);

  watchdogTimer = setInterval(() => {
    const t = now();

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s?.worker) continue;

      if (s.state === ENGINE_STATE.BUSY && t - s.lastSearchTick > 12000) {
        markDead(i);
      }
    }
  }, 2000);
}

// ================= INIT =================
self.onmessage = (e) => {
  const { cmd, fen, depth, mpv } = e.data;

  if (cmd === "init") {
    if (!slots.length) {
      for (let i = 0; i < MAX_ENGINES; i++) slots[i] = makeSlot(i);
    }
    for (let i = 0; i < MAX_ENGINES; i++) spawnSlot(i);
    startWatchdog();
  }

  if (cmd === "search") {
    startSearch(fen, depth, mpv);
  }
};
