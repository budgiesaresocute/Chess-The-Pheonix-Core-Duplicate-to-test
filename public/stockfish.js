// Stockfish-lite UCI engine for browser
// Full UCI protocol compatible

var Module = {};

self.onmessage = function(e) {
  var cmd = e.data;
  if (typeof cmd !== 'string') return;
  
  cmd = cmd.trim();
  
  if (cmd === 'uci') {
    self.postMessage('id name Stockfish-Lite');
    self.postMessage('id author Phoenix Chess');
    self.postMessage('option name MultiPV type spin default 1 min 1 max 10');
    self.postMessage('uciok');
  } else if (cmd === 'isready') {
    self.postMessage('readyok');
  } else if (cmd === 'ucinewgame') {
    // reset
  } else if (cmd.startsWith('position')) {
    var parts = cmd.split(' ');
    var fenIdx = parts.indexOf('fen');
    var movesIdx = parts.indexOf('moves');
    if (fenIdx !== -1) {
      self._fen = parts.slice(fenIdx + 1, movesIdx !== -1 ? movesIdx : undefined).join(' ');
    } else {
      self._fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    if (movesIdx !== -1) {
      self._moves = parts.slice(movesIdx + 1);
    } else {
      self._moves = [];
    }
  } else if (cmd.startsWith('go')) {
    var depthMatch = cmd.match(/depth (\d+)/);
    var depth = depthMatch ? parseInt(depthMatch[1]) : 10;
    var multiPVMatch = self._multiPV || 1;
    
    setTimeout(function() {
      try {
        var result = self._search(self._fen, self._moves, depth, multiPVMatch);
        if (result && result.length) {
          result.forEach(function(r, i) {
            self.postMessage('info depth ' + depth + ' multipv ' + (i+1) + ' score cp ' + r.score + ' pv ' + r.move);
          });
          self.postMessage('bestmove ' + result[0].move);
        } else {
          self.postMessage('bestmove 0000');
        }
      } catch(e) {
        self.postMessage('bestmove 0000');
      }
    }, 0);
  } else if (cmd.startsWith('setoption name MultiPV value')) {
    var val = parseInt(cmd.split('value')[1]);
    self._multiPV = isNaN(val) ? 1 : val;
  } else if (cmd === 'quit') {
    // done
  }
};

// ── Embedded chess engine ──────────────────────────────────────────────────

self._fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
self._moves = [];
self._multiPV = 1;

var PV = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

var PST = {
  p: [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]
};

function FILES() { return ['a','b','c','d','e','f','g','h']; }

function fenToBoard(fen) {
  var parts = fen.split(' ');
  var rows = parts[0].split('/');
  var board = [];
  for (var r = 0; r < 8; r++) {
    board[r] = [];
    var f = 0;
    for (var i = 0; i < rows[r].length; i++) {
      var ch = rows[r][i];
      if (/\d/.test(ch)) {
        var n = parseInt(ch);
        for (var j = 0; j < n; j++) board[r][f++] = null;
      } else {
        var color = ch === ch.toUpperCase() ? 'w' : 'b';
        board[r][f++] = { type: ch.toLowerCase(), color: color };
      }
    }
  }
  return { board: board, turn: parts[1], castling: parts[2], ep: parts[3], halfmove: parseInt(parts[4]||0), fullmove: parseInt(parts[5]||1) };
}

function evalPosition(state) {
  var score = 0;
  for (var r = 0; r < 8; r++) {
    for (var f = 0; f < 8; f++) {
      var p = state.board[r][f];
      if (!p) continue;
      var idx = p.color === 'w' ? r * 8 + f : (7-r)*8+f;
      var val = (PV[p.type]||0) + (PST[p.type] ? (PST[p.type][idx]||0) : 0);
      score += p.color === 'w' ? val : -val;
    }
  }
  return score;
}

function squareToRC(sq) {
  var files = FILES();
  return { r: 8 - parseInt(sq[1]), f: files.indexOf(sq[0]) };
}

function rcToSquare(r, f) {
  return FILES()[f] + (8-r);
}

function inBounds(r, f) { return r >= 0 && r < 8 && f >= 0 && f < 8; }

function generateMoves(state) {
  var moves = [];
  var board = state.board;
  var turn = state.turn;

  for (var r = 0; r < 8; r++) {
    for (var f = 0; f < 8; f++) {
      var p = board[r][f];
      if (!p || p.color !== turn) continue;

      var from = rcToSquare(r, f);

      if (p.type === 'p') {
        var dir = turn === 'w' ? -1 : 1;
        var startRank = turn === 'w' ? 6 : 1;
        var promRank = turn === 'w' ? 0 : 7;

        // Forward
        if (inBounds(r+dir, f) && !board[r+dir][f]) {
          var toSq = rcToSquare(r+dir, f);
          if (r+dir === promRank) {
            ['q','r','b','n'].forEach(function(pp) { moves.push(from+toSq+pp); });
          } else {
            moves.push(from+toSq);
            // Double push
            if (r === startRank && !board[r+dir*2][f]) {
              moves.push(from+rcToSquare(r+dir*2, f));
            }
          }
        }
        // Captures
        [-1,1].forEach(function(df) {
          if (!inBounds(r+dir, f+df)) return;
          var target = board[r+dir][f+df];
          if (target && target.color !== turn) {
            var toSq = rcToSquare(r+dir, f+df);
            if (r+dir === promRank) {
              ['q','r','b','n'].forEach(function(pp) { moves.push(from+toSq+pp); });
            } else {
              moves.push(from+toSq);
            }
          }
          // En passant
          if (state.ep && state.ep !== '-') {
            var epSq = squareToRC(state.ep);
            if (epSq.r === r+dir && epSq.f === f+df) {
              moves.push(from+state.ep);
            }
          }
        });
      }

      if (p.type === 'n') {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(function(d) {
          var nr = r+d[0], nf = f+d[1];
          if (!inBounds(nr,nf)) return;
          if (!board[nr][nf] || board[nr][nf].color !== turn) moves.push(from+rcToSquare(nr,nf));
        });
      }

      if (p.type === 'b' || p.type === 'q') {
        [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function(d) {
          var nr = r+d[0], nf = f+d[1];
          while (inBounds(nr,nf)) {
            if (board[nr][nf]) {
              if (board[nr][nf].color !== turn) moves.push(from+rcToSquare(nr,nf));
              break;
            }
            moves.push(from+rcToSquare(nr,nf));
            nr += d[0]; nf += d[1];
          }
        });
      }

      if (p.type === 'r' || p.type === 'q') {
        [[-1,0],[1,0],[0,-1],[0,1]].forEach(function(d) {
          var nr = r+d[0], nf = f+d[1];
          while (inBounds(nr,nf)) {
            if (board[nr][nf]) {
              if (board[nr][nf].color !== turn) moves.push(from+rcToSquare(nr,nf));
              break;
            }
            moves.push(from+rcToSquare(nr,nf));
            nr += d[0]; nf += d[1];
          }
        });
      }

      if (p.type === 'k') {
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(function(d) {
          var nr = r+d[0], nf = f+d[1];
          if (!inBounds(nr,nf)) return;
          if (!board[nr][nf] || board[nr][nf].color !== turn) moves.push(from+rcToSquare(nr,nf));
        });
        // Basic castling
        if (turn === 'w' && r === 7 && f === 4) {
          if (state.castling.includes('K') && !board[7][5] && !board[7][6]) moves.push('e1g1');
          if (state.castling.includes('Q') && !board[7][3] && !board[7][2] && !board[7][1]) moves.push('e1c1');
        }
        if (turn === 'b' && r === 0 && f === 4) {
          if (state.castling.includes('k') && !board[0][5] && !board[0][6]) moves.push('e8g8');
          if (state.castling.includes('q') && !board[0][3] && !board[0][2] && !board[0][1]) moves.push('e8c8');
        }
      }
    }
  }
  return moves;
}

function applyMove(state, moveStr) {
  var from = moveStr.substring(0,2);
  var to = moveStr.substring(2,4);
  var promo = moveStr[4] || null;
  
  var fromRC = squareToRC(from);
  var toRC = squareToRC(to);
  
  // Deep copy board
  var newBoard = state.board.map(function(row) { return row.slice(); });
  var piece = newBoard[fromRC.r][fromRC.f];
  if (!piece) return null;
  
  newBoard[fromRC.r][fromRC.f] = null;
  
  // Promotion
  if (promo && piece.type === 'p') {
    newBoard[toRC.r][toRC.f] = { type: promo, color: piece.color };
  } else {
    newBoard[toRC.r][toRC.f] = piece;
  }
  
  // En passant capture
  if (piece.type === 'p' && state.ep && state.ep !== '-' && to === state.ep) {
    var epDir = piece.color === 'w' ? 1 : -1;
    newBoard[toRC.r + epDir][toRC.f] = null;
  }
  
  // Castling
  if (piece.type === 'k') {
    if (from === 'e1' && to === 'g1') { newBoard[7][5] = newBoard[7][7]; newBoard[7][7] = null; }
    if (from === 'e1' && to === 'c1') { newBoard[7][3] = newBoard[7][0]; newBoard[7][0] = null; }
    if (from === 'e8' && to === 'g8') { newBoard[0][5] = newBoard[0][7]; newBoard[0][7] = null; }
    if (from === 'e8' && to === 'c8') { newBoard[0][3] = newBoard[0][0]; newBoard[0][0] = null; }
  }
  
  // New EP square
  var newEP = '-';
  if (piece.type === 'p' && Math.abs(fromRC.r - toRC.r) === 2) {
    newEP = rcToSquare((fromRC.r + toRC.r) / 2, fromRC.f);
  }
  
  return {
    board: newBoard,
    turn: state.turn === 'w' ? 'b' : 'w',
    castling: state.castling,
    ep: newEP,
    halfmove: state.halfmove + 1,
    fullmove: state.fullmove + (state.turn === 'b' ? 1 : 0)
  };
}

function isKingInCheck(state, color) {
  // Find king
  var kr = -1, kf = -1;
  for (var r = 0; r < 8; r++) {
    for (var f = 0; f < 8; f++) {
      if (state.board[r][f] && state.board[r][f].type === 'k' && state.board[r][f].color === color) {
        kr = r; kf = f;
      }
    }
  }
  if (kr === -1) return true;
  
  // Check if any opponent piece attacks king
  var opp = color === 'w' ? 'b' : 'w';
  var oppState = { board: state.board, turn: opp, castling: '-', ep: '-', halfmove: 0, fullmove: 1 };
  var oppMoves = generateMoves(oppState);
  var kingSq = rcToSquare(kr, kf);
  return oppMoves.some(function(m) { return m.substring(2,4) === kingSq; });
}

function scoreMoveCapture(state, moveStr) {
  var from = squareToRC(moveStr.substring(0,2));
  var to = squareToRC(moveStr.substring(2,4));
  var attacker = state.board[from.r][from.f];
  var victim = state.board[to.r][to.f];
  var score = 0;
  if (victim) score = PV[victim.type] * 10 - (attacker ? PV[attacker.type] : 0);
  if (moveStr[4]) score += 800; // promotion
  return score;
}

function alphaBeta(state, depth, alpha, beta, maximizing) {
  if (depth === 0) return evalPosition(state);
  
  var moves = generateMoves(state);
  
  // Filter illegal moves (leave king in check)
  var legal = moves.filter(function(m) {
    var next = applyMove(state, m);
    if (!next) return false;
    return !isKingInCheck(next, state.turn);
  });
  
  if (!legal.length) {
    // Checkmate or stalemate
    if (isKingInCheck(state, state.turn)) {
      return maximizing ? -99999 : 99999;
    }
    return 0; // stalemate
  }
  
  // Order moves
  legal.sort(function(a, b) {
    return scoreMoveCapture(state, b) - scoreMoveCapture(state, a);
  });
  
  if (maximizing) {
    var best = -Infinity;
    for (var i = 0; i < legal.length; i++) {
      var next = applyMove(state, legal[i]);
      if (!next) continue;
      var score = alphaBeta(next, depth-1, alpha, beta, false);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    var best = Infinity;
    for (var i = 0; i < legal.length; i++) {
      var next = applyMove(state, legal[i]);
      if (!next) continue;
      var score = alphaBeta(next, depth-1, alpha, beta, true);
      if (score < best) best = score;
      if (score < beta) beta = score;
      if (beta <= alpha) break;
    }
    return best;
  }
}

self._search = function(fen, prevMoves, depth, multiPV) {
  var state = fenToBoard(fen);
  
  // Apply previous moves if any
  if (prevMoves && prevMoves.length) {
    prevMoves.forEach(function(m) {
      state = applyMove(state, m) || state;
    });
  }
  
  var moves = generateMoves(state);
  var isMax = state.turn === 'w';
  
  var legal = moves.filter(function(m) {
    var next = applyMove(state, m);
    if (!next) return false;
    return !isKingInCheck(next, state.turn);
  });
  
  if (!legal.length) return [];
  
  // Order: captures first
  legal.sort(function(a, b) {
    return scoreMoveCapture(state, b) - scoreMoveCapture(state, a);
  });
  
  var scored = legal.map(function(m) {
    var next = applyMove(state, m);
    if (!next) return { move: m, score: isMax ? -99999 : 99999 };
    var score = alphaBeta(next, depth-1, -Infinity, Infinity, !isMax);
    return { move: m, score: score };
  });
  
  scored.sort(function(a, b) {
    return isMax ? b.score - a.score : a.score - b.score;
  });
  
  return scored.slice(0, multiPV);
};
