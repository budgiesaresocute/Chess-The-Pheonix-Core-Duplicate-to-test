import { createStockfish } from "./stockfishBot.js";

let cluster = null;
let fallback = null;

export function initEngine() {
  if (!cluster) {
    try {
      cluster = new Worker("/stockfish-worker.js");
      cluster.postMessage({ cmd: "init" });
    } catch (e) {
      console.log("Cluster worker not available, using fallback");
    }
  }

  if (!fallback) {
    fallback = createStockfish();
  }
}

function getThinkTime(depth) {
  const depthTimeMap = {
    18: 6000,
    24: 18000,
    28: 30000,
    32: 45000,
    36: 70000
  };
  
  return depthTimeMap[depth] || 5000;
}

export function getBestMoveFromPool(fen, depth = 10, mpv = 7) {
  return new Promise((resolve) => {
    let done = false;
    let fallbackTriggered = false;

    const thinkTime = getThinkTime(depth);

    const timeout = setTimeout(async () => {
      if (done || fallbackTriggered) return;

      fallbackTriggered = true;
      done = true;

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
