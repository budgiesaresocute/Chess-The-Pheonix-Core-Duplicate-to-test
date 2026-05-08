import { createStockfish } from "./stockfishBot.js";

let cluster = null;
let fallback = null;

export function initEngine() {
  if (!cluster) {
    try {
      cluster = new Worker("/stockfish-worker.js");
      cluster.postMessage({ cmd: "init" });
    } catch (e) {
      console.log("⚠️ Cluster worker not available, using fallback");
    }
  }

  if (!fallback) {
    fallback = createStockfish();
  }
}

// ============================================
// Optimized thinking time mapping for Stockfish 18
// ============================================
function getThinkTime(depth) {
  const depthTimeMap = {
    10: 500,
    18: 1500,
    22: 2500,
    24: 3500,
    28: 5000,
    30: 4000,
    32: 6000,
    36: 8000,
    40: 10000,
    44: 12000,
  };
  
  return depthTimeMap[depth] || (500 + depth * 100);
}

export function getBestMoveFromPool(fen, depth = 10, mpv = 7) {
  return new Promise((resolve) => {
    let done = false;
    let fallbackTriggered = false;

    const thinkTime = getThinkTime(depth);
    console.log(`📊 Thinking for ${thinkTime}ms at depth ${depth}`);

    const timeout = setTimeout(async () => {
      if (done || fallbackTriggered) return;

      fallbackTriggered = true;
      done = true;

      console.log('⏱️ Timeout reached, using fallback engine');
      const moves = await fallback.getBestMoveFromPool(fen, depth, mpv);
      resolve(moves || []);
    }, thinkTime + 5000);

    if (cluster) {
      cluster.onmessage = (e) => {
        if (done) return;

        if (e.data?.type === "result") {
          fallbackTriggered = true;
          done = true;

          clearTimeout(timeout);
          console.log(`✅ Got ${e.data.moves?.length || 0} moves from cluster`);
          resolve(e.data.moves || []);
        }
      };

      cluster.postMessage({
        cmd: "search",
        fen,
        depth,
        mpv
      });
    } else {
      clearTimeout(timeout);
      fallback.getBestMoveFromPool(fen, depth, mpv).then(resolve);
    }
  });
}

export function getBestMove(fen, depth = 10, mpv = 1) {
  return new Promise((resolve) => {
    let done = false;
    let fallbackTriggered = false;

    const thinkTime = getThinkTime(depth);

    const timeout = setTimeout(async () => {
      if (done || fallbackTriggered) return;

      fallbackTriggered = true;
      done = true;

      const move = await fallback.getBestMove(fen, depth, mpv);
      resolve(move);
    }, thinkTime + 5000);

    if (cluster) {
      cluster.onmessage = (e) => {
        if (done) return;

        if (e.data?.type === "result") {
          fallbackTriggered = true;
          done = true;

          clearTimeout(timeout);
          resolve(e.data.moves?.[0] || null);
        }
      };

      cluster.postMessage({
        cmd: "search",
        fen,
        depth,
        mpv
      });
    } else {
      clearTimeout(timeout);
      fallback.getBestMove(fen, depth, mpv).then(resolve);
    }
  });
}
