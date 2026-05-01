import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';
import PhoenixPanel from '../components/chess/PhoenixPanel';
import { getPhoenixMoves, rollDice } from '../lib/phoenixCoreLogic';
import {
  playMoveSound, playCaptureSound, playCheckSound,
  playCheckmateSound, playPhoenixReviveSound, playDiceSound, playGameStartSound
} from '../lib/chessSounds';

function createPhoenixState() {
  return {
    positions: { w: 'e1', b: 'e8' },
    active: { w: true, b: true },
    used: { w: false, b: false },
    turnsSinceMoved: { w: 0, b: 0 },
  };
}

// Tutorial modal
function PhoenixTutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: '🔥 What is Phoenix Core?',
      text: 'Phoenix Core is a special chess variant where each player has an invisible Phoenix piece that can save their King once per game!',
      icon: '🔥',
    },
    {
      title: '👑 The Phoenix Starts on Your King',
      text: 'At the start of the game, your Phoenix is on the same square as your King (White: E1, Black: E8). You can see its position shown on the board as a glowing aura around your King.',
      icon: '👑',
    },
    {
      title: '🎲 Moving the Phoenix',
      text: 'Every 3 turns you MUST move your Phoenix. Roll the dice to determine HOW it moves:\n1 = Pawn movement\n2 = Knight movement\n3 = Bishop movement\n4 = Rook movement\n5 = Queen movement\n6 = King movement',
      icon: '🎲',
    },
    {
      title: '⚠️ The 3-Turn Rule',
      text: 'You MUST move your Phoenix every 3 turns. If you try to make a normal chess move on turn 3 without moving your Phoenix first, your move will be blocked! Roll the dice and move the Phoenix first.',
      icon: '⚠️',
    },
    {
      title: '✈️ The Revival — Your Lifeline',
      text: 'When your King is checkmated, instead of losing, your King TELEPORTS to wherever your Phoenix currently is! This saves you ONCE per game. After revival, your Phoenix is gone.',
      icon: '✈️',
    },
    {
      title: '🛡️ Phoenix Safety',
      text: 'If your Phoenix is on a square that is under attack by an enemy piece when you get checkmated — the revival FAILS and you lose! Always keep your Phoenix on a safe square.',
      icon: '🛡️',
    },
    {
      title: '🏁 Ready to Play!',
      text: 'Good luck! Remember: Move your Phoenix every 3 turns, keep it safe, and use your revival wisely. The Phoenix is your secret weapon!',
      icon: '🏁',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">{steps[step].icon}</div>
          <h3 className="text-lg font-black text-foreground">{steps[step].title}</h3>
        </div>

        <p className="text-sm text-muted-foreground text-center leading-relaxed whitespace-pre-line mb-6">
          {steps[step].text}
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${
              i === step ? 'bg-primary w-4' : 'bg-border'
            }`} />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2 rounded-xl border border-border text-foreground text-sm font-medium">
              ← Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              Next →
            </button>
          ) : (
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              Let's Play! 🔥
            </button>
          )}
        </div>

        <button onClick={onClose} className="w-full mt-2 text-xs text-muted-foreground/50 hover:text-muted-foreground">
          Skip tutorial
        </button>
      </div>
    </div>
  );
}

export default function PhoenixCore({ timerMode, onBack }) {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [history, setHistory] = useState([]);
  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || 600);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || 600);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  const [phoenixState, setPhoenixState] = useState(createPhoenixState());
  const [phoenixSelected, setPhoenixSelected] = useState(false);
  const [diceValue, setDiceValue] = useState(null);
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState(false);
  const [phoenixMoves, setPhoenixMoves] = useState([]);
  const [turnCount, setTurnCount] = useState(0);
  const [revivalNotif, setRevivalNotif] = useState(null);

  const timerRef = useRef(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const phoenixStateRef = useRef(phoenixState);
  useEffect(() => { phoenixStateRef.current = phoenixState; }, [phoenixState]);

  useEffect(() => { playGameStartSound(); }, []);

  useEffect(() => {
    if (!timerRunning || gameOver) return;
    timerRef.current = setInterval(() => {
      const turn = gameRef.current.turn();
      if (turn === 'w') {
        setWhiteTime(t => { if (t <= 1) { endByTimeout('w'); return 0; } return t - 1; });
      } else {
        setBlackTime(t => { if (t <= 1) { endByTimeout('b'); return 0; } return t - 1; });
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerRunning, gameOver]);

  const endByTimeout = (color) => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setGameOver({ result: color === 'w' ? 'Black wins' : 'White wins', reason: 'Time out' });
  };

  const findKingSquare = (g, color) => {
    const board = g.board();
    for (let r = 0; r < 8; r++)
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === 'k' && p.color === color)
          return String.fromCharCode(97 + f) + (8 - r);
      }
    return null;
  };
    
  const updateCheckSquare = useCallback((g) => {
    if (g.inCheck()) setCheckSquare(findKingSquare(g, g.turn()));
    else setCheckSquare(null);
  }, []);

  const isSquareUnderAttack = (g, square, byColor) => {
    // Check if any piece of byColor attacks the given square
    const tempFen = g.fen().split(' ');
    tempFen[1] = byColor;
    try {
      const tempGame = new Chess(tempFen.join(' '));
      const moves = tempGame.moves({ verbose: true });
      return moves.some(m => m.to === square);
    } catch { return false; }
  };

  const moveKingInFen = (fen, fromSq, toSq, color) => {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    const expand = (row) => {
      const r = [];
      for (const ch of row) /\d/.test(ch) ? r.push(...Array(+ch).fill('.')) : r.push(ch);
      return r;
    };
    const collapse = (arr) => {
      let s = '', e = 0;
      for (const ch of arr) ch === '.' ? e++ : (e && (s += e, e = 0), s += ch);
      return s + (e ? e : '');
    };
    const b = rows.map(expand);
    const fc = (sq) => ({ f: sq.charCodeAt(0)-97, r: parseInt(sq[1])-1 });
    const from = fc(fromSq), to = fc(toSq);
    b[7-from.r][from.f] = '.';
    b[7-to.r][to.f] = color === 'w' ? 'K' : 'k';
    parts[0] = b.map(collapse).join('/');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[2] = '-';
    parts[3] = '-';
    return parts.join(' ');
  };

  const handlePotentialRevival = useCallback((g, checkmatedColor, ps) => {
    const phoenixPos = ps.positions[checkmatedColor];
    const phoenixActive = ps.active[checkmatedColor];
    const revivalUsed = ps.used[checkmatedColor];

    if (!phoenixActive || !phoenixPos || revivalUsed) return false;

    const kingSquare = findKingSquare(g, checkmatedColor);
    if (!kingSquare || phoenixPos === kingSquare) return false;

    // FIXED: Check if phoenix square is under attack by ANY opponent piece
    // If it is, revival FAILS — game over
    const opponentColor = checkmatedColor === 'w' ? 'b' : 'w';
    const phoenixUnderAttack = isSquareUnderAttack(g, phoenixPos, opponentColor);

    if (phoenixUnderAttack) {
      // Phoenix is under attack — revival fails, game over
      return false;
    }

    // Phoenix is safe — do the teleport
    const newFen = moveKingInFen(g.fen(), kingSquare, phoenixPos, checkmatedColor);
    if (!newFen) return false;

    let revivedGame;
    try { revivedGame = new Chess(newFen); } catch { return false; }

    // Make sure the revived position is not immediately checkmate
    if (revivedGame.isCheckmate()) return false;

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
    setRevivalNotif(`🔥 ${colorName} Phoenix activated! King teleported to ${phoenixPos.toUpperCase()}!`);
    setTimeout(() => setRevivalNotif(null), 4000);
    return true;
  }, [updateCheckSquare]);

  const mustMovePhoenix = (ps, color) =>
    ps.active[color] &&
    ps.positions[color] !== null &&
    (ps.turnsSinceMoved[color] || 0) >= 3;

  const applyMove = useCallback((g, move) => {
    const newGame = new Chess(g.fen());
    let result;
    try { result = newGame.move(move); } catch { return null; }
    if (!result) return null;

    if (result.captured) playCaptureSound(); else playMoveSound();
    if (newGame.inCheck() && !newGame.isCheckmate()) playCheckSound();

    setLastMove({ from: result.from, to: result.to });
    setHistory(newGame.history({ verbose: true }));

    const currentColor = g.turn();
    setPhoenixState(prev => {
      const newTurns = { ...prev.turnsSinceMoved };
      newTurns[currentColor] = (newTurns[currentColor] || 0) + 1;
      return { ...prev, turnsSinceMoved: newTurns };
    });

    setTurnCount(t => t + 1);
    setDiceValue(null);
    setHasRolledThisTurn(false);
    setPhoenixSelected(false);
    setPhoenixMoves([]);

    if (newGame.isCheckmate()) {
      const checkmatedColor = newGame.turn();
      const revived = handlePotentialRevival(newGame, checkmatedColor, phoenixStateRef.current);
      if (!revived) {
        playCheckmateSound();
        setTimerRunning(false);
        setGameOver({ result: checkmatedColor === 'w' ? 'Black wins' : 'White wins', reason: 'Checkmate' });
        setGame(newGame);
      }
    } else if (newGame.isDraw()) {
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
    const turn = game.turn();
    const ps = phoenixStateRef.current;
    if (!ps.active[turn] || hasRolledThisTurn) return;
    // Only allow rolling on turn 3 (must move) or optionally earlier
    const roll = rollDice(null);
    playDiceSound();
    setDiceValue(roll);
    setHasRolledThisTurn(true);
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

    const DICE_TO_PIECE = { 1:'p', 2:'n', 3:'b', 4:'r', 5:'q', 6:'k' };
    const pieceType = DICE_TO_PIECE[diceValue] || 'p';
    const board = game.board();
    const moves = getPhoenixMoves(phoenixPos, pieceType, board, turn);

    setPhoenixSelected(true);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPhoenixMoves(moves);
  };

  const handlePhoenixMove = useCallback((toSquare) => {
    const turn = game.turn();
    setPhoenixState(prev => ({
      ...prev,
      positions: { ...prev.positions, [turn]: toSquare },
      turnsSinceMoved: { ...prev.turnsSinceMoved, [turn]: 0 },
    }));
    setPhoenixSelected(false);
    setPhoenixMoves([]);
    setDiceValue(null);
    setHasRolledThisTurn(false);
    playMoveSound();
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [game]);

  const handleSquareClick = useCallback((square) => {
    if (gameOver) return;
    if (!timerRunning && history.length === 0) setTimerRunning(true);

    const turn = game.turn();
    const ps = phoenixStateRef.current;

    if (phoenixSelected) {
      if (phoenixMoves.includes(square)) {
        handlePhoenixMove(square);
      } else {
        setPhoenixSelected(false);
        setPhoenixMoves([]);
      }
      return;
    }

    if (mustMovePhoenix(ps, turn)) {
      setRevivalNotif('⚠️ You must move your Phoenix first! Roll the dice.');
      setTimeout(() => setRevivalNotif(null), 2500);
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
          setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
    } else {
      const piece = game.get(square);
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));
      }
    }
  }, [game, selectedSquare, legalMoves, phoenixSelected, phoenixMoves,
      gameOver, timerRunning, history, applyMove, handlePhoenixMove]);

  const handleRestart = () => {
    const newGame = new Chess();
    setGame(newGame);
    setSelectedSquare(null); setLegalMoves([]); setLastMove(null);
    setCheckSquare(null); setGameOver(null); setHistory([]);
    setPhoenixState(createPhoenixState());
    setPhoenixSelected(false); setDiceValue(null);
    setHasRolledThisTurn(false); setPhoenixMoves([]);
    setTurnCount(0);
    setWhiteTime(timerMode?.seconds || 600);
    setBlackTime(timerMode?.seconds || 600);
    setTimerRunning(false);
    playGameStartSound();
  };

  const currentTurn = game.turn();
  const currentMustMove = mustMovePhoenix(phoenixState, currentTurn);

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter">
      {showTutorial && <PhoenixTutorial onClose={() => setShowTutorial(false)} />}

      <GameHeader
        mode="phoenix"
        onBack={onBack}
        gameStatus={game.inCheck() && !game.isGameOver() ? '⚠ Check!' : null}
      />

      {/* Tutorial button */}
      <div className="flex justify-end px-4 pt-1">
        <button
          onClick={() => setShowTutorial(true)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg border border-border hover:border-primary/50"
        >
          📖 How to play
        </button>
      </div>

      {revivalNotif && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-orange-500/90 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl animate-bounce">
          {revivalNotif}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-700 border border-gray-500" />
              <span className={`text-sm font-bold ${currentTurn === 'b' ? 'text-primary' : 'text-muted-foreground'}`}>
                Black {currentTurn === 'b' && '← Turn'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {phoenixState.active.b
                ? `🔴 Phoenix: ${phoenixState.positions.b?.toUpperCase()}`
                : '🔴 Phoenix used'}
            </span>
          </div>

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

          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white" />
              <span className={`text-sm font-bold ${currentTurn === 'w' ? 'text-primary' : 'text-muted-foreground'}`}>
                White {currentTurn === 'w' && '← Turn'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {phoenixState.active.w
                ? `🔵 Phoenix: ${phoenixState.positions.w?.toUpperCase()}`
                : '🔵 Phoenix used'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <GameTimer
            whiteTime={whiteTime}
            blackTime={blackTime}
            activeColor={currentTurn}
            isRunning={timerRunning}
          />

          {currentMustMove && (
            <div className="bg-red-500/20 border border-red-500 rounded-xl p-3 text-center animate-pulse">
              <span className="text-red-400 font-bold text-sm">⚠️ Must move Phoenix now!</span>
            </div>
          )}

          <PhoenixPanel
            currentTurn={currentTurn}
            phoenixState={phoenixState}
            diceValue={diceValue}
            hasRolledThisTurn={hasRolledThisTurn}
            mustMovePhoenix={currentMustMove}
            phoenixSelected={phoenixSelected}
            onSelectPhoenix={handleSelectPhoenix}
            onRollDice={handleRollDice}
            turnCount={turnCount}
          />

                                            <div className="flex gap-2">
            <button onClick={() => {
              if (history.length < 2) return;
              const newGame = new Chess();
              game.history().slice(0, -2).forEach(m => newGame.move(m));
              setGame(newGame);
              setSelectedSquare(null); setLegalMoves([]);
              setLastMove(null); setPhoenixSelected(false);
              setPhoenixMoves([]); setDiceValue(null);
              setHasRolledThisTurn(false);
              updateCheckSquare(newGame);
              setHistory(newGame.history({ verbose: true }));
            }} disabled={history.length < 2}
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40 transition-colors font-medium">
              ↩ Undo
            </button>
            <button onClick={handleRestart}
              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors font-medium">
              ↺ Restart
            </button>
          </div>

          <div style={{ height: '180px' }}>
            <MoveHistory history={history} />
          </div>

          {/* Tutorial quick reference */}
          <div className="text-xs text-muted-foreground bg-card rounded-lg p-3 border border-border">
            <div className="font-semibold text-foreground mb-1 flex items-center justify-between">
              <span>🔥 Phoenix Rules</span>
              <button onClick={() => setShowTutorial(true)} className="text-primary text-xs">Full tutorial →</button>
            </div>
            <div>• Move Phoenix every 3 turns (mandatory)</div>
            <div>• Moving Phoenix = free action (no turn cost)</div>
            <div>• Checkmated? King teleports to Phoenix</div>
            <div>• Phoenix under attack? Revival fails!</div>
            <div>• One revival per game only</div>
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
