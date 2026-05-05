// =====================================
// Phoenix Stockfish Bot (CLEAN v12 FINAL)
// Single-engine • Stable • MultiPV ready
// =====================================

let sf = null;
let isReady = false;
let failed = false;

let session = 0;
let pending = null;
let topMoves = [];
let initPromise = null;

const MAX_PV = 7;        // needed for vortex
const TIMEOUT = 12000;   // stable timeout

// ================= INIT =================
function loadStockfish() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    const sources = [
      "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js",
      "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-16-single.js",
      "https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16-single.js"
    ];

    const tryNext = (i = 0) => {
      if (i >= sources.length) {
        failed = true;
        resolve(false);
        return;
      }

      try {
        importScripts(sources[i]);

        sf =
          typeof STOCKFISH !== "undefined"
            ? STOCKFISH()
            : typeof Stockfish !== "undefined"
            ? Stockfish()
            : null;

        if (!sf) return tryNext(i + 1);

        sf.onmessage = (e) =>
          handleMessage(typeof e === "string" ? e : e.data);

        sf.postMessage("uci");
        sf.postMessage("isready");

        setTimeout(() => resolve(true), 3000);
      } catch {
        tryNext(i + 1);
      }
    };

    tryNext();
  });

  return initPromise;
}

// ================= MESSAGE HANDLER =================
function handleMessage(line) {
  if (!line || failed) return;

  if (line === "uciok" || line === "readyok") {
    isReady = true;
    return;
  }

  // ================= MULTIPV TRACK =================
  if (line.startsWith("info") && line.includes(" pv ")) {
    const pvIndex = line.indexOf(" pv ");
    const pv = line.slice(pvIndex + 4).trim().split(/\s+/);

    const mpvMatch = line.match(/multipv (\d+)/);
    const depthMatch = line.match(/ depth (\d+)/);

    const id = mpvMatch ? +mpvMatch[1] : 1;
    const depth = depthMatch ? +depthMatch[1] : 0;

    const prev = topMoves[id];

    // keep best depth per line
    if (!prev || depth > prev.depth) {
      topMoves[id] = {
        move: pv[0],
        depth
      };
    }
  }

  // ================= FINAL MOVE =================
  if (line.startsWith("bestmove")) {
    const best = line.split(" ")[1];

    if (pending?.session === session) {
      const moves = Object.values(topMoves)
        .filter(Boolean)
        .sort((a, b) => b.depth - a.depth)
        .map(m => m.move);

      pending.resolve(
        moves.length
          ? moves
          : (best && best !== "(none)" ? [best] : [])
      );

      pending = null;
    }

    topMoves = [];
  }
}

// ================= SEARCH =================
function search(fen, depth = 10, mpv = 3) {
  return new Promise(async (resolve) => {
    const ready = await loadStockfish();
    if (!ready || !sf) return resolve([]);

    session++;
    const mySession = session;

    topMoves = [];

    pending = {
      session: mySession,
      resolve
    };

    try {
      sf.postMessage("stop");
      sf.postMessage("ucinewgame");

      // clamp mpv safely
      const pv = Math.min(Math.max(1, mpv), MAX_PV);

      sf.postMessage(`setoption name MultiPV value ${pv}`);
      sf.postMessage(`position fen ${fen}`);

      // depth search (stable + consistent)
      sf.postMessage(`go depth ${depth}`);
    } catch {
      resolve([]);
      return;
    }

    // ================= SAFETY TIMEOUT =================
    setTimeout(() => {
      if (pending?.session === mySession) {
        pending.resolve([]);
        pending = null;
      }
    }, TIMEOUT);
  });
}

// ================= API =================
export function createStockfish() {
  loadStockfish();

  return {
    // 🔥 BEST MOVE ONLY (for Phoenix if needed)
    getBestMove: async (fen, depth = 10) => {
      const moves = await search(fen, depth, 1);
      return moves.length ? moves[0] : null;
    },

    // 🔥 MOVE POOL (for all bots)
    getBestMoveFromPool: async (fen, depth = 10, mpv = 3) => {
      const moves = await search(fen, depth, mpv);
      return moves;
    },

    // stop current search cleanly
    stop: () => {
      session++;
      pending = null;
      topMoves = [];
      try {
        sf?.postMessage("stop");
      } catch {}
    }
  };
      }
