import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';
import PhoenixPanel from '../components/chess/PhoenixPanel';
import {
  createPhoenixState, getPhoenixMoves, rollDice, PIECE_DICE_VALUES
} from '../lib/phoenixCoreLogic';
import {
  playMoveSound, playCaptureSound, playCheckSound,
  playCheckmateSound, playPhoenixReviveSound, playDiceSound, playGameStartSound
} from '../lib/chessSounds';

const TIMER_SECONDS = 60;

export default function PhoenixCore({ timerMode, onBack }) {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [history, setHistory] = useState([]);
  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || TIMER_SECONDS);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || TIMER_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);

  // Phoenix Core state
  const [phoenixState, setPhoenixState] = useState(createPhoenixState());
  const [phoenixSelected, setPhoenixSelected] = useState(false);
  const [diceValue, setDiceValue] = useState(null);
  const [phoenixMoves, setPhoenixMoves] = useState([]);
  const [turnCount, setTurnCount] = useState(0);
  const [mustMovePhoenix, setMustMovePhoenix] = useState(false);

  // Revival notification
  const [revivalNotif, setRevivalNotif] = useState(null);

  const timerRef = useRef(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  const handlePotentialRevival = useCallback((g, checkmatedColor, ps) => {
  const phoenixPos = ps.positions[checkmatedColor];
  const phoenixActive = ps.active[checkmatedColor];
  const revivalUsed = ps.used[checkmatedColor];

  if (!phoenixActive || !phoenixPos || revivalUsed) return false;

  // Check if phoenix square is under attack
  try {
    const fenParts = g.fen().split(' ');
    fenParts[1] = checkmatedColor === 'w' ? 'b' : 'w';
    const attackerGame = new Chess(fenParts.join(' '));
    const attackerMoves = attackerGame.moves({ verbose: true });
    if (attackerMoves.some(m => m.to === phoenixPos)) return false;
  } catch { return false; }

  // Teleport king
  const kingSquare = findKingSquare(g, checkmatedColor);
  if (!kingSquare) return false;

  const newFen = moveKingInFen(g.fen(), kingSquare, phoenixPos, checkmatedColor);
  if (!newFen) return false;

  let revivedGame;
  try { revivedGame = new Chess(newFen); } catch { return false; }

  setPhoenixState(prev => ({
    ...prev,
    used: { ...prev.used, [checkmatedColor]: true },
    active: { ...prev.active, [checkmatedColor]: false },
    positions: { ...prev.positions, [checkmatedColor]: null },
  }));

  setGame(revivedGame);
  setLastMove(null);
  setCheckSquare(null);
  updateCheckSquare(revivedGame);
  playPhoenixReviveSound();

  const colorName = checkmatedColor === 'w' ? 'White' : 'Black';
  setRevivalNotif(`${colorName} Phoenix Core activated! King teleported to ${phoenixPos.toUpperCase()}!`);
  setTimeout(() => setRevivalNotif(null), 4000);

  return true;
}, [updateCheckSquare]);
  const phoenixStateRef = useRef(phoenixState);
  useEffect(() => {
    phoenixStateRef.current = phoenixState;
  }, [phoenixState]);

  useEffect(() => {
    playGameStartSound();
  }, []);

  // Timer
  useEffect(() => {
    if (!timerRunning || gameOver) return;
    timerRef.current = setInterval(() => {
      const currentGame = gameRef.current;
      const turn = currentGame.turn();
      if (turn === 'w') {
        setWhiteTime(t => {
          if (t <= 1) { endByTimeout('w'); return 0; }
          return t - 1;
        });
      } else {
        setBlackTime(t => {
          if (t <= 1) { endByTimeout('b'); return 0; }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerRunning, gameOver]);

  const endByTimeout = (color) => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setGameOver({
      result: color === 'w' ? 'Black wins' : 'White wins',
      reason: 'Time out',
    });
  };

  const findKingSquare = (g, color) => {
    const board = g.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === 'k' && p.color === color) {
          return String.fromCharCode(97 + f) + (8 - r);
        }
      }
    }
    return null;
  };

  const updateCheckSquare = useCallback((g) => {
    if (g.inCheck()) {
      const sq = findKingSquare(g, g.turn());
      setCheckSquare(sq);
    } else {
      setCheckSquare(null);
    }
  }, []);

  // Check if a square is safe for the king (not under attack)
  const isSquareSafe = (g, square, kingColor) => {
    const opponentColor = kingColor === 'w' ? 'b' : 'w';
    const fenParts = g.fen().split(' ');
    fenParts[1] = opponentColor;
    const tempFen = fenParts.join(' ');
    try {
      const tempGame = new Chess(tempFen);
      const oppMoves = tempGame.moves({ verbose: true });
      return !oppMoves.some(m => m.to === square);
    } catch {
      return false;
    }
  };

  // Manipulate FEN to move king from one square to another
  const moveKingInFen = (fen, fromSquare, toSquare, color) => {
    const fenParts = fen.split(' ');
    const rows = fenParts[0].split('/');

    const sqToCoords = (sq) => ({
      file: sq.charCodeAt(0) - 97,
      rank: parseInt(sq[1]) - 1,
    });

    const fromC = sqToCoords(fromSquare);
    const toC = sqToCoords(toSquare);

    const expandRow = (row) => {
      const result = [];
      for (const ch of row) {
        if (/\d/.test(ch)) {
          for (let i = 0; i < parseInt(ch); i++) result.push('.');
        } else {
          result.push(ch);
        }
      }
      return result;
    };

    const collapseRow = (arr) => {
      let result = '';
      let empty = 0;
      for (const ch of arr) {
        if (ch === '.') {
          empty++;
        } else {
          if (empty > 0) { result += empty; empty = 0; }
          result += ch;
        }
      }
      if (empty > 0) result += empty;
      return result;
    };

    const board = rows.map(expandRow);
    const kingChar = color === 'w' ? 'K' : 'k';

    const fromRowIdx = 7 - fromC.rank;
    board[fromRowIdx][fromC.file] = '.';

    const toRowIdx = 7 - toC.rank;
    board[toRowIdx][toC.file] = kingChar;

    const newFenBoard = board.map(collapseRow).join('/');

    const nextTurn = fenParts[1] === 'w' ? 'b' : 'w';
    fenParts[0] = newFenBoard;
    fenParts[1] = nextTurn;
    fenParts[2] = '-'; // No castling after teleport
    fenParts[3] = '-'; // No en passant

    return fenParts.join(' ');
  };

  // ✅ FIX: handlePotentialRevival now receives ps as a parameter
  // instead of reading from the closure — always uses fresh state
  const handlePotentialRevival = useCallback( newGame, checkmatedColor, ps) => {
    const phoenixPos = ps.positions[checkmatedColor];
    const phoenixActive = ps.active[checkmatedColor];
    const revivalUsed = ps.used[checkmatedColor];

    if (!phoenixActive || !phoenixPos || revivalUsed) {
      return false;
    }

    // Check if Phoenix Core itself is under attack
    const fenParts = g.fen().split(' ');
    fenParts[1] = checkmatedColor === 'w' ? 'b' : 'w';
    const attackerFen = fenParts.join(' ');
    try {
      const attackerGame = new Chess(attackerFen);
      const attackerMoves = attackerGame.moves({ verbose: true });
      const phoenixUnderAttack = attackerMoves.some(m => m.to === phoenixPos);

      if (phoenixUnderAttack) {
        return false;
      }
    } catch {
      return false;
    }

    // Check if king can safely teleport to Phoenix position
    const isSafe = isSquareSafe(g, phoenixPos, checkmatedColor);
    if (!isSafe) {
      return false;
    }

    // REVIVAL! Teleport king to phoenix position
    const kingSquare = findKingSquare(g, checkmatedColor);
    if (!kingSquare) return false;

    const newFen = moveKingInFen(g.fen(), kingSquare, phoenixPos, checkmatedColor);
    if (!newFen) return false;

    let revivedGame;
    try {
      revivedGame = new Chess(newFen);
    } catch {
      return false;
    }

    // Mark phoenix as used and remove it
    setPhoenixState(prev => ({
      ...prev,
      used: { ...prev.used, [checkmatedColor]: true },
      active: { ...prev.active, [checkmatedColor]: false },
      positions: { ...prev.positions, [checkmatedColor]: null },
    }));

    setGame(revivedGame);
    setLastMove(null);
    updateCheckSquare(revivedGame);
    playPhoenixReviveSound();

    const colorName = checkmatedColor === 'w' ? 'White' : 'Black';
    setRevivalNotif(`${colorName} Phoenix Core activated! King teleported to ${phoenixPos.toUpperCase()}!`);
    setTimeout(() => setRevivalNotif(null), 4000);

    return true;
  }, [updateCheckSquare]);

  const applyMove = useCallback((g, move) => {
    const newGame = new Chess(g.fen());
    let result;
    try {
      result = newGame.move(move);
    } catch {
      return null;
    }
    if (!result) return null;

    const isCapture = result.captured;
    const isCheck = newGame.inCheck();
    const isCheckmate = newGame.isCheckmate();
    const isDraw = newGame.isDraw();

    if (isCapture) playCaptureSound();
    else playMoveSound();
    if (isCheck && !isCheckmate) playCheckSound();

    setLastMove({ from: result.from, to: result.to });
    setHistory(newGame.history({ verbose: true }));

    // Update phoenix turn counter
    const currentColor = g.turn();
    setPhoenixState(prev => {
      const newTurns = { ...prev.turnsSinceMoved };
      newTurns[currentColor] = (newTurns[currentColor] || 0) + 1;
      const newMust = { ...prev.mustMove };
      newMust[currentColor] = newTurns[currentColor] >= 3;
      return { ...prev, turnsSinceMoved: newTurns, mustMove: newMust };
    });
    setTurnCount(t => t + 1);
    setDiceValue(null);
    setPhoenixSelected(false);
    setPhoenixMoves([]);

    if (isCheckmate) {
      const checkmatedColor = newGame.turn();
      // ✅ FIX: Use phoenixStateRef.current for fresh state, not stale closure
      const revived = handlePotentialRevival(g, newGame, checkmatedColor, phoenixStateRef.current);
      if (!revived) {
        playCheckmateSound();
        setTimerRunning(false);
        const winner = checkmatedColor === 'w' ? 'Black wins' : 'White wins';
        setGameOver({ result: winner, reason: 'Checkmate' });
        setGame(newGame);
      }
    } else if (isDraw) {
      setTimerRunning(false);
      setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
      setGame(newGame);
    } else {
      setGame(newGame);
      updateCheckSquare(newGame);
    }

    return newGame;
  }, [updateCheckSquare, handlePotentialRevival]);

  const handleRollDice = () => {
    const lastRoll = phoenixState.lastDice[game.turn()];
    const roll = rollDice(lastRoll);
    playDiceSound();
    setDiceValue(roll);
    setPhoenixState(prev => ({
      ...prev,
      lastDice: { ...prev.lastDice, [game.turn()]: roll },
    }));
  };

  const handleSelectPhoenix = () => {
    if (!diceValue) return;
    const turn = game.turn();
    const phoenixPos = phoenixState.positions[turn];
    if (!phoenixPos || !phoenixState.active[turn]) return;

    if (phoenixSelected) {
      setPhoenixSelected(false);
      setPhoenixMoves([]);
      return;
    }

    const pieceType = Object.keys(PIECE_DICE_VALUES).find(
      k => PIECE_DICE_VALUES[k] === diceValue
    ) || 'p';

    const board = game.board();
    const moves = getPhoenixMoves(phoenixPos, pieceType, board, turn);

    setPhoenixSelected(true);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPhoenixMoves(moves);
  };

  const handlePhoenixMove = (toSquare) => {
    const turn = game.turn();

    setPhoenixState(prev => ({
      ...prev,
      positions: { ...prev.positions, [turn]: toSquare },
      turnsSinceMoved: { ...prev.turnsSinceMoved, [turn]: 0 },
      mustMove: { ...prev.mustMove, [turn]: false },
    }));

    setPhoenixSelected(false);
    setPhoenixMoves([]);
    setDiceValue(null);
    playMoveSound();

    // Switch turn
    const fenParts = game.fen().split(' ');
    fenParts[1] = turn === 'w' ? 'b' : 'w';
    if (turn === 'b') {
      fenParts[5] = (parseInt(fenParts[5]) + 1).toString();
    }
    const newFen = fenParts.join(' ');
    try {
      const newGame = new Chess(newFen);
      setGame(newGame);
      setHistory(newGame.history({ verbose: true }));
      setTurnCount(t => t + 1);
    } catch {}
  };

  const handleSquareClick = useCallback((square) => {
    if (gameOver) return;
    if (!timerRunning && history.length === 0) setTimerRunning(true);

    const turn = game.turn();

    if (phoenixSelected) {
      if (phoenixMoves.includes(square)) {
        handlePhoenixMove(square);
      } else {
        setPhoenixSelected(false);
        setPhoenixMoves([]);
      }
      return;
    }

    if (mustMovePhoenix && phoenixState.active[turn] && phoenixState.positions[turn]) {
      return;
    }

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        const moves = game.moves({ square: selectedSquare, verbose: true });
        const move = moves.find(m => m.to === square);
        applyMove(game, {
          from: selectedSquare,
          to: square,
          promotion: move?.promotion ? 'q' : undefined,
        });
        setSelectedSquare(null);
        setLegalMoves([]);
      } else {
        const piece = game.get(square);
        if (piece && piece.color === turn) {
          setSelectedSquare(square);
          const moves = game.moves({ square, verbose: true });
          setLegalMoves(moves.map(m => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const piece = game.get(square);
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setLegalMoves(moves.map(m => m.to));
      }
    }
  }, [game, selectedSquare, legalMoves, phoenixSelected, phoenixMoves, gameOver,
      mustMovePhoenix, phoenixState, timerRunning, history, applyMove]);

  const handleUndo = () => {
    const newGame = new Chess();
    const hist = game.history();
    hist.slice(0, -2).forEach(m => newGame.move(m));
    setGame(newGame);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPhoenixSelected(false);
    setPhoenixMoves([]);
    setDiceValue(null);
    updateCheckSquare(newGame);
    setHistory(newGame.history({ verbose: true }));
  };

  const handleRestart = () => {
    const newGame = new Chess();
    setGame(newGame);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setCheckSquare(null);
    setGameOver(null);
    setHistory([]);
    setPhoenixState(createPhoenixState());
    setPhoenixSelected(false);
    setDiceValue(null);
    setPhoenixMoves([]);
    setTurnCount(0);
    setMustMovePhoenix(false);
    setWhiteTime(timerMode?.seconds || TIMER_SECONDS);
    setBlackTime(timerMode?.seconds || TIMER_SECONDS);
    setTimerRunning(false);
    playGameStartSound();
  };

  const currentTurn = game.turn();

  const currentMustMovePhoenix =
    phoenixState.active[currentTurn] &&
    phoenixState.positions[currentTurn] &&
    (phoenixState.turnsSinceMoved[currentTurn] || 0) >= 3;

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter">
      <GameHeader
        mode="phoenix"
        onBack={onBack}
        gameStatus={game.inCheck() && !game.isGameOver() ? '⚠ Check!' : null}
      />

      {revivalNotif && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-orange-500/90 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl animate-bounce">
          🔥 {revivalNotif}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Black info */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-700 border border-gray-500" />
              <span className={`text-sm font-bold ${currentTurn === 'b' ? 'text-primary' : 'text-muted-foreground'}`}>
                Black {currentTurn === 'b' && '← Turn'}
              </span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {phoenixState.active.b ? `🔴 ${phoenixState.positions.b?.toUpperCase() || '?'}` : '🔴 Gone'}
              {phoenixState.used.b && ' (used)'}
            </span>
          </div>

          {/* ✅ FIX: Show BOTH phoenix cores on the board at all times */}
          <ChessBoard
            game={game}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            checkSquare={checkSquare}
            phoenixSquares={phoenixState.positions}
            phoenixMoves={phoenixMoves}
            phoenixSelected={phoenixSelected}
            activePhoenixColor={currentTurn}
          />

          {/* White info */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white" />
              <span className={`text-sm font-bold ${currentTurn === 'w' ? 'text-primary' : 'text-muted-foreground'}`}>
                White {currentTurn === 'w' && '← Turn'}
              </span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {phoenixState.active.w ? `🔵 ${phoenixState.positions.w?.toUpperCase() || '?'}` : '🔵 Gone'}
              {phoenixState.used.w && ' (used)'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs lg:max-w-[240px]">
          <GameTimer
            whiteTime={whiteTime}
            blackTime={blackTime}
            activeColor={currentTurn}
            isRunning={timerRunning}
          />

          <PhoenixPanel
            currentTurn={currentTurn}
            phoenixState={phoenixState}
            diceValue={diceValue}
            mustMovePhoenix={currentMustMovePhoenix}
            phoenixSelected={phoenixSelected}
            onSelectPhoenix={handleSelectPhoenix}
            onRollDice={handleRollDice}
            turnCount={turnCount}
          />

          <div className="flex gap-2">
            <button onClick={handleUndo} disabled={history.length < 2}
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40 transition-colors font-medium">
              ↩ Undo
            </button>
            <button onClick={handleRestart}
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors font-medium">
              ↺ Restart
            </button>
          </div>

          <div className="flex-1 min-h-0" style={{ height: '220px' }}>
            <MoveHistory history={history} />
          </div>

          <div className="text-xs text-muted-foreground bg-card rounded-lg p-3 border border-border space-y-1">
            <div className="font-semibold text-foreground mb-1">🔥 Phoenix Rules</div>
            <div>• Move Phoenix every 3 turns</div>
            <div>• Roll dice to determine movement</div>
            <div>• On checkmate, king teleports to Phoenix</div>
            <div>• One revival per game</div>
          </div>
        </div>
      </div>

      <GameOverModal
        result={gameOver?.result}
        reason={gameOver?.reason}
        onRematch={handleRestart}
        onMenu={onBack}
      />
    </div>
  );
      }
                                             
