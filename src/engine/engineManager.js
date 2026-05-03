import { createStockfish } from "./stockfish.js";

let cluster = null;
let fallback = null;

// ================= INIT =================
export function initEngine() {
  if (!cluster) {
    cluster = new Worker("/stockfish-worker.js");
    cluster.postMessage({ cmd: "init" });
  }

  if (!fallback) {
    fallback = createStockfish();
  }
}

// ================= TIME CONTROL (NEW LICHESS STYLE) =================
function getThinkTime(depth) {
  const MIN_TIME = 1200; // minimum thinking time
  const MAX_TIME = 6000; // max cap

  const time = MIN_TIME + depth * 120;
  return Math.min(MAX_TIME, time);
}

// ================= MAIN BOT API =================
export function getBestMove(fen, depth = 10, mpv = 1) {
  return new Promise((resolve) => {
    let done = false;
    let fallbackTriggered = false;

    const thinkTime = getThinkTime(depth);

    // ================= FALLBACK SAFETY =================
    const timeout = setTimeout(async () => {
      if (done || fallbackTriggered) return;

      fallbackTriggered = true;
      done = true;

      const move = await fallback.getBestMove(fen, depth, mpv);
      resolve(move);
    }, thinkTime + 500); // slightly above engine thinking window

    // ================= CLUSTER RESPONSE =================
    cluster.onmessage = (e) => {
      if (done) return;

      if (e.data?.type === "result") {
        fallbackTriggered = true;
        done = true;

        clearTimeout(timeout);

        resolve(e.data.moves?.[0] || null);
      }
    };

    // ================= SEND TO CLUSTER =================
    cluster.postMessage({
      cmd: "search",
      fen,
      depth,
      mpv
    });
  });
}
