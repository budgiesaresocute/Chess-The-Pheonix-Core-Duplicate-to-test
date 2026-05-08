// =====================================
// Phoenix Stockfish Bot (v18.0 ENHANCED)
// Optimized for deep analysis with Stockfish 18
// =====================================
let sf = null;
let isReady = false;
let failed = false;

let session = 0;
let pending = null;
let topMoves = [];
let initPromise = null;

const MAX_PV = 7;
const TIMEOUT = 90000; // Extended timeout for deeper analysis

function loadStockfish() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    // Prioritize Stockfish 18, fall back to 17
    const sources = [
      "https://cdn.jsdelivr.net/npm/stockfish@18.0.0/src/stockfish-nnue-16-single.js",
      "https://unpkg.com/stockfish@18.0.0/src/stockfish-nnue-16-single.js",
      "https://cdn.jsdelivr.net/npm/stockfish@17.1.0/src/stockfish-nnue-16-single.js",
      "https://unpkg.com/stockfish@17.1.0/src/stockfish-nnue-16-single.js",
      "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js",
    ];

    const tryNext = (i = 0) => {
      if (i >= sources.length) {
        failed = true;
        console.error('❌ Failed to load Stockfish from all sources');
        resolve(false);
        return;
      }

      try {
        console.log(`🔄 Loading Stockfish from: ${sources[i]}`);
        importScripts(sources[i]);

        sf =
          typeof STOCKFISH !== "undefined"
            ? STOCKFISH()
            : typeof Stockfish !== "undefined"
            ? Stockfish()
            : null;

        if (!sf) {
          console.log(`⚠️ Source ${i} failed, trying next...`);
          return tryNext(i + 1);
        }

        console.log('✅ Stockfish loaded successfully');

        sf.onmessage = (e) =>
          handleMessage(typeof e === "string" ? e : e.data);

        sf.postMessage("uci");
        sf.postMessage("isready");

        setTimeout(() => resolve(true), 3000);
      } catch (e) {
        console.log(`⚠️ Error loading source ${i}:`, e.message);
        tryNext(i + 1);
      }
    };

    tryNext();
  });

  return initPromise;
}

function handleMessage(line) {
  if (!line || failed) return;

  if (line === "uciok" || line === "readyok") {
    isReady = true;
    return;
  }

  // Parse info lines with principal variations
  if (line.startsWith("info") && line.includes(" pv ")) {
    const idx = line.indexOf(" pv ");
    const pv = line.slice(idx + 4).trim().split(/\s+/);

    const mpv = line.match(/multipv (\d+)/);
    const depth = line.match(/ depth (\d+)/);
    const seldepth = line.match(/ seldepth (\d+)/);
    const score = line.match(/ score (cp|mate) (-?\d+)/);

    const id = mpv ? +mpv[1] : 1;
    const d = depth ? +depth[1] : 0;
    const sd = seldepth ? +seldepth[1] : d;

    const prev = topMoves[id];

    if (!prev || d > prev.depth || (d === prev.depth && sd > prev.seldepth)) {
      topMoves[id] = {
        move: pv[0],
        depth: d,
        seldepth: sd,
        score: score ? score[0] : null
      };
    }
  }

  // When search completes
  if (line.startsWith("bestmove")) {
    const best = line.split(" ")[1];

    if (pending?.session === session) {
      const moves = Object.values(topMoves)
        .filter(Boolean)
        .sort((a, b) => {
          if (b.depth !== a.depth) return b.depth - a.depth;
          return b.seldepth - a.seldepth;
        })
        .map(m => m.move);

      pending.resolve(moves.length ? moves : [best]);
      pending = null;
    }

    topMoves = [];
  }
}

function search(fen, depth, mpv = 1) {
  return new Promise(async (resolve) => {
    const ready = await loadStockfish();
    if (!ready || !sf) {
      console.error('❌ Stockfish not ready');
      return resolve([]);
    }

    session++;
    const mySession = session;

    topMoves = [];
    pending = { session: mySession, resolve };

    sf.postMessage("stop");
    sf.postMessage("ucinewgame");
    
    const mpvCount = Math.min(mpv, MAX_PV);
    sf.postMessage(`setoption name MultiPV value ${mpvCount}`);
    sf.postMessage(`position fen ${fen}`);
    
    console.log(`🔍 Starting search: depth=${depth}, mpv=${mpvCount}`);
    sf.postMessage(`go depth ${depth}`);

    setTimeout(() => {
      if (pending?.session === mySession) {
        console.log('⏱️ Search timeout, returning current best moves');
        pending.resolve(Object.values(topMoves)
          .filter(Boolean)
          .map(m => m.move)
        );
        pending = null;
      }
    }, TIMEOUT);
  });
}

export function createStockfish() {
  loadStockfish();

  return {
    getBestMove: async (fen, depth = 10, mpv = 1) => {
      const moves = await search(fen, depth, mpv);
      return moves.length ? moves[0] : null;
    },

    getBestMoveFromPool: async (fen, depth = 10, mpv = 7) => {
      const moves = await search(fen, depth, mpv);
      return moves.length ? moves : [];
    },

    stop: () => {
      session++;
      pending = null;
      topMoves = [];
      sf?.postMessage("stop");
    },

    terminate: () => {
      sf?.postMessage("stop");
      sf = null;
      isReady = false;
    }
  };
}
