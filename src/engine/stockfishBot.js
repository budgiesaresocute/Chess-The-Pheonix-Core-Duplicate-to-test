import { Chess } from 'chess.js';

// Minimax fallback (runs in main thread if worker fails completely)
const PV_FB = { p:100, n:320, b:330, r:500, q:900, k:20000 };
const PST_FB = {
  p: [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]
};

function evalFB(chess) {
  if (chess.isCheckmate()) return chess.turn()==='w'?-99999:99999;
  if (chess.isDraw()) return 0;
  let s=0; const b=chess.board();
  for(let r=0;r<8;r++) for(let f=0;f<8;f++){const p=b[r][f];if(!p)continue;const i=p.color==='w'?r*8+f:(7-r)*8+f;s+=(p.color==='w'?1:-1)*(PV_FB[p.type]+(PST_FB[p.type]?.[i]||0));}
  return s;
}

function orderFB(moves) {
  return [...moves].sort((a,b)=>{
    let sa=0,sb=0;
    if(a.captured)sa+=PV_FB[a.captured]*10-PV_FB[a.piece];
    if(b.captured)sb+=PV_FB[b.captured]*10-PV_FB[b.piece];
    if(a.flags?.includes('p'))sa+=800;
    if(b.flags?.includes('p'))sb+=800;
    return sb-sa;
  });
}

function abFB(chess,depth,alpha,beta,max) {
  if(depth===0||chess.isGameOver()) return evalFB(chess);
  const moves=orderFB(chess.moves({verbose:true}));
  if(max){let best=-Infinity;for(const m of moves){chess.move(m);best=Math.max(best,abFB(chess,depth-1,alpha,beta,false));chess.undo();alpha=Math.max(alpha,best);if(beta<=alpha)break;}return best;}
  else{let best=Infinity;for(const m of moves){chess.move(m);best=Math.min(best,abFB(chess,depth-1,alpha,beta,true));chess.undo();beta=Math.min(beta,best);if(beta<=alpha)break;}return best;}
}

function minimaxFallback(fen, depth, poolSize) {
  const chess = new Chess(fen);
  const moves = chess.moves({verbose:true});
  if(!moves.length) return [];
  const isMax = chess.turn()==='w';
  const scored = orderFB(moves).map(m=>{
    chess.move(m);
    const score=abFB(chess,Math.max(1,depth-1),-Infinity,Infinity,!isMax);
    chess.undo();
    return {move:m.from+m.to+(m.promotion||''),score};
  });
  scored.sort((a,b)=>isMax?b.score-a.score:a.score-b.score);
  return scored.slice(0,Math.min(poolSize,scored.length)).map(s=>s.move);
}

// ── Worker management ─────────────────────────────────────────────────────
let worker = null;
let workerReady = false;
let workerEngine = 'unknown';
let initP = null;
const queue = [];

function getWorker() {
  if (initP) return initP;
  initP = new Promise((resolve) => {
    try {
      worker = new Worker('/stockfish-worker.js');
    } catch {
      resolve(false); return;
    }

    let resolved = false;
    const done = (v) => { if(!resolved){resolved=true;resolve(v);} };

    worker.onmessage = (e) => {
      const { type, moves, engine } = e.data;
      if (type === 'ready' || type === 'fallback') {
        workerReady = true;
        workerEngine = engine || 'unknown';
        console.log(`🎮 Chess engine: ${engine === 'stockfish' ? '✅ Real Stockfish WASM' : '⚡ Minimax engine'}`);
        done(true);
      }
      if (type === 'result') {
        const resolver = queue.shift();
        if (resolver) resolver(moves || []);
      }
    };

    worker.onerror = (err) => {
      console.warn('Worker error:', err);
      worker = null;
      done(false);
    };

    worker.postMessage({ cmd: 'init' });
    setTimeout(() => done(false), 15000);
  });
  return initP;
}

function workerSearch(fen, depth, poolSize) {
  return new Promise((resolve) => {
    if (!worker || !workerReady) { resolve([]); return; }
    queue.push(resolve);
    worker.postMessage({ cmd: 'search', fen, depth, mpv: poolSize });
    setTimeout(() => {
      const idx = queue.indexOf(resolve);
      if (idx !== -1) { queue.splice(idx, 1); resolve([]); }
    }, 10000);
  });
}

// ── Public API ────────────────────────────────────────────────────────────
export function createStockfish() {
  getWorker().then(ok => {
    if (!ok) console.warn('⚠️ Worker failed, using main-thread minimax');
  });

  const getBestMoveFromPool = async (fen, depth, poolSize = 1) => {
    const ready = await getWorker();

    if (ready && worker && workerReady) {
      const moves = await workerSearch(fen, depth, poolSize);
      if (moves.length > 0) {
        const pick = moves.slice(0, Math.min(poolSize, moves.length));
        return pick[Math.floor(Math.random() * pick.length)];
      }
    }

    // Last resort: main thread minimax
    return new Promise(resolve => {
      setTimeout(() => {
        const moves = minimaxFallback(fen, Math.min(depth, 5), poolSize);
        resolve(moves.length ? moves[Math.floor(Math.random() * moves.length)] : null);
      }, 10);
    });
  };

  return {
    getBestMoveFromPool,
    getBestMove: async (fen, depth, useTopMoves = false) => {
      return getBestMoveFromPool(fen, depth, useTopMoves ? 3 : 1);
    },
    terminate: () => {
      if (worker) { worker.terminate(); worker = null; }
      workerReady = false;
      initP = null;
      queue.length = 0;
    }
  };
}
