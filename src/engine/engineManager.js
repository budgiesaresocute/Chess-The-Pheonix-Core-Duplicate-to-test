import { createStockfish } from "./stockfishBot.js";

let cluster = null;
let fallback = null;

export function initEngine() {

  if (!cluster) {
    try {

      cluster = new Worker("/stockfish-worker.js");

      cluster.postMessage({
        cmd: "init"
      });

      console.log("✅ Cluster worker initialized");

    } catch (e) {

      console.log(
        "⚠️ Worker unavailable, using fallback"
      );
    }
  }

  if (!fallback) {
    fallback = createStockfish();
  }
}

function getThinkTime(depth) {

  const depthMap = {
    8: 300,
    10: 500,
    14: 900,
    18: 1500,
    20: 2200,
    24: 3500,
    28: 5000,
    32: 7000,
    35: 9000,
    38: 12000,
  };

  return depthMap[depth] || (500 + depth * 120);
}

function runClusterSearch({
  fen,
  depth,
  mpv
}) {

  return new Promise((resolve) => {

    if (!cluster) {
      resolve(null);
      return;
    }

    const requestId =
      `${Date.now()}-${Math.random()}`;

    const timeout = setTimeout(() => {

      cluster.removeEventListener(
        "message",
        handler
      );

      resolve(null);

    }, getThinkTime(depth) + 5000);

    const handler = (e) => {

      if (
        e.data?.type !== "result" ||
        e.data?.requestId !== requestId
      ) {
        return;
      }

      clearTimeout(timeout);

      cluster.removeEventListener(
        "message",
        handler
      );

      resolve(e.data.moves || []);
    };

    cluster.addEventListener(
      "message",
      handler
    );

    cluster.postMessage({
      cmd: "search",
      requestId,
      fen,
      depth,
      mpv
    });
  });
}

export async function getBestMoveFromPool(
  fen,
  depth = 10,
  mpv = 7
) {

  initEngine();

  try {

    const clusterMoves =
      await runClusterSearch({
        fen,
        depth,
        mpv
      });

    if (
      clusterMoves &&
      clusterMoves.length
    ) {

      console.log(
        `✅ Cluster returned ${clusterMoves.length} moves`
      );

      return clusterMoves;
    }

    console.log(
      "⚠️ Falling back to local engine"
    );

    return await fallback.getBestMoveFromPool(
      fen,
      depth,
      mpv,
      getThinkTime(depth)
    );

  } catch (e) {

    console.error(
      "❌ Engine manager error",
      e
    );

    return await fallback.getBestMoveFromPool(
      fen,
      depth,
      mpv,
      getThinkTime(depth)
    );
  }
}

export async function getBestMove(
  fen,
  depth = 10,
  mpv = 1
) {

  const moves =
    await getBestMoveFromPool(
      fen,
      depth,
      mpv
    );

  return moves?.[0] || null;
}

export function stopEngine() {

  try {
    cluster?.postMessage({
      cmd: "stop"
    });
  } catch {}

  fallback?.stop?.();
}

export function newGame() {

  try {
    cluster?.postMessage({
      cmd: "newgame"
    });
  } catch {}

  fallback?.newGame?.();
}

export function destroyEngine() {

  stopEngine();

  try {
    cluster?.terminate?.();
  } catch {}

  cluster = null;

  fallback?.terminate?.();

  fallback = null;
}
