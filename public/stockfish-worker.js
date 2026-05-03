// =====================================
// Phoenix CORE++ v17 (MAX STRENGTH BROWSER)
// Lichess-style controller (clean, no weakening logic)
// =====================================

const MAX_ENGINES = 2;

const ENGINE_STATE = {
  INIT: 0,
  LOADING: 1,
  READY: 2,
  BUSY: 3
};

const slots = [];
let initialized = false;

// ================= ENGINE =================
function createEngine() {
  const src =
    "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js";

  importScripts(src);

  return STOCKFISH ? STOCKFISH() : Stockfish();
}

// ================= SLOT =================
function makeSlot(i) {
  return {
    i,
    worker: null,
    state: ENGINE_STATE.INIT,
    job: null
  };
}

// ================= SPAWN =================
function spawn(i) {
  const s = slots[i];

  const w = createEngine();
  if (!w) return;

  s.worker = w;
  s.state = ENGINE_STATE.LOADING;

  w.onmessage = (e) => onMsg(i, typeof e === "string" ? e : e.data);

  w.postMessage("uci");
}

// ================= ENGINE PICK =================
function getEngine() {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].state === ENGINE_STATE.READY && !slots[i].job) {
      return i;
    }
  }
  return -1;
}

// ================= SEARCH =================
function search(fen) {
  return new Promise((resolve) => {
    const id = getEngine();
    if (id === -1) return resolve(null);

    const s = slots[id];

    s.job = { resolve };
    s.state = ENGINE_STATE.BUSY;

    s.worker.postMessage("stop");
    s.worker.postMessage("ucinewgame");
    s.worker.postMessage(`position fen ${fen}`);

    // ⭐ REAL STRENGTH CONTROL
    s.worker.postMessage("go movetime 7000");

    setTimeout(() => {
      if (s.job) {
        s.job.resolve(null);
        s.job = null;
      }
    }, 7500);
  });
}

// ================= ENGINE OUTPUT =================
function onMsg(i, line) {
  const s = slots[i];
  if (!s?.worker) return;

  if (line === "uciok") {
    s.worker.postMessage("isready");
    return;
  }

  if (line === "readyok") {
    s.state = ENGINE_STATE.READY;
    return;
  }

  if (s.state !== ENGINE_STATE.BUSY) return;

  if (line.startsWith("bestmove")) {
    const move = line.split(" ")[1];

    const job = s.job;
    s.job = null;

    job.resolve(move);
    s.state = ENGINE_STATE.READY;
  }
}

// ================= INIT =================
self.onmessage = (e) => {
  const { cmd, fen } = e.data;

  if (cmd === "init") {
    if (initialized) return;
    initialized = true;

    if (!slots.length) {
      for (let i = 0; i < MAX_ENGINES; i++) {
        slots[i] = makeSlot(i);
        spawn(i);
      }
    }
  }

  if (cmd === "search") {
    search(fen).then((move) => {
      self.postMessage({ type: "move", move });
    });
  }
};
