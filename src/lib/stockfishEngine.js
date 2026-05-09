let engine = null;

export async function initEngine() {
  return new Promise((resolve) => {
    engine = new Worker('/stockfish.js');

    engine.postMessage('uci');

    engine.onmessage = (e) => {
      if (e.data === 'uciok') {
        resolve();
      }
    };
  });
}

export async function evaluatePosition(
  fen,
  depth = 12
) {
  return new Promise((resolve) => {
    let latestEval = 0;
    let bestMove = null;
    let pv = '';
    let mate = null;

    // ============================================
    // IMPORTANT:
    // Stockfish gives eval from side-to-move
    // perspective.
    //
    // We convert EVERYTHING into
    // WHITE perspective.
    // ============================================

    const sideToMove =
      fen.split(' ')[1];

    engine.onmessage = (e) => {
      const line = e.data;

      // ============================================
      // CENTIPAWN SCORE
      // ============================================

      if (line.includes('score cp')) {
        const match =
          line.match(/score cp (-?\d+)/);

        if (match) {
          let evalCp = parseInt(
            match[1]
          );

          // Convert to WHITE perspective
          if (sideToMove === 'b') {
            evalCp = -evalCp;
          }

          latestEval = evalCp;
        }
      }

      // ============================================
      // MATE SCORE
      // ============================================

      if (line.includes('score mate')) {
        const mateMatch =
          line.match(/score mate (-?\d+)/);

        if (mateMatch) {
          let mateScore = parseInt(
            mateMatch[1]
          );

          // Convert to WHITE perspective
          if (sideToMove === 'b') {
            mateScore = -mateScore;
          }

          mate = mateScore;

          // ============================================
          // PROFESSIONAL FIX:
          //
          // Convert mate scores into huge evals
          // so:
          //
          // - ACPL works
          // - Accuracy works
          // - Blunder detection works
          // - Eval graph works
          // - Turning points work
          // ============================================

          // Mate in 1  => 9999
          // Mate in 2  => 9998
          // Mate in -1 => -9999

          if (mateScore > 0) {
            latestEval =
              10000 -
              Math.abs(mateScore);
          } else {
            latestEval =
              -10000 +
              Math.abs(mateScore);
          }
        }
      }

      // ============================================
      // PRINCIPAL VARIATION
      // ============================================

      if (line.includes(' pv ')) {
        const pvMatch =
          line.match(/ pv (.+)/);

        if (pvMatch) {
          pv = pvMatch[1];
        }
      }

      // ============================================
      // BEST MOVE
      // ============================================

      if (line.includes('bestmove')) {
        const parts =
          line.split(' ');

        bestMove = parts[1];

        resolve({
          eval: latestEval,
          bestMove,
          pv,
          mate,
          depth,
        });
      }
    };

    // ============================================
    // SEND POSITION
    // ============================================

    engine.postMessage(
      `position fen ${fen}`
    );

    // ============================================
    // START SEARCH
    // ============================================

    engine.postMessage(
      `go depth ${depth}`
    );
  });
}
