import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playGameStartSound } from '../lib/chessSounds';

const BOTS = [
  { id: 'astra',   name: 'Astra',         emoji: '🌱', depth: 2,  label: 'Beginner',     personality: 'Still learning…' },
  { id: 'orion',   name: 'Orion',         emoji: '⭐', depth: 4,  label: 'Easy',         personality: "Let's play!" },
  { id: 'titanx',  name: 'TitanX',        emoji: '⚔️', depth: 6,  label: 'Intermediate', personality: 'Stay sharp.' },
  { id: 'vortex',  name: 'Vortex',        emoji: '🌪️', depth: 8,  label: 'Advanced',     personality: 'I see everything.' },
  { id: 'zenith',  name: 'Zenith',        emoji: '👑', depth: 10, label: 'Master',       personality: 'You must be precise.' },
  { id: 'phoenix', name: 'Phoenix Prime', emoji: '🔥', depth: 18, label: 'Maximum',      personality: 'This is your end.' },
];

const PROMOTION_PIECES = [
  { value: 'q', label: '♛', name: 'Queen' },
  { value: 'r', label: '♜', name: 'Rook' },
  { value: 'b', label: '♝', name: 'Bishop' },
  { value: 'n', label: '♞', name: 'Knight' },
];

const PIECE_IMAGES = {
  wq: 'https://www.chess.com/chess-themes/pieces/neo/150/wq.png',
  wr: 'https://www.chess.com/chess-themes/pieces/neo/150/wr.png',
  wb: 'https://www.chess.com/chess-themes/pieces/neo/150/wb.png',
  wn: 'https://www.chess.com/chess-themes/pieces/neo/150/wn.png',
  bq: 'https://www.chess.com/chess-themes/pieces/neo/150/bq.png',
  br: 'https://www.chess.com/chess-themes/pieces/neo/150/br.png',
  bb: 'https://www.chess.com/chess-themes/pieces/neo/150/bb.png',
  bn: 'https://www.chess.com/chess-themes/pieces/neo/150/bn.png',
};

export default function NormalChess({ timerMode, onBack }) {
  const [selectedBot, setSelectedBot] = useState(null);
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
  const [isThinking, setIsThinking] = useState(false);
  const [promotionMove, setPromotionMove] = useState(null);

  const timerRef = useRef(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    if (!selectedBot) return;
    playGameStartSound();
  }, [selectedBot]);

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

  const updateCheckSquare = useCallback((g) => {
    if (g.inCheck()) {
      const board = g.board();
      const turn = g.turn();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = board[r][f];
          if (p && p.type === 'k' && p.color === turn) {
            setCheckSquare(String.fromCharCode(97 + f) + (8 - r));
            return;
          }
        }
      }
    } else setCheckSquare(null);
  }, []);

  const applyBotMove = useCallback((from, to, promotion) => {
    setGame(prev => {
      const newGame = new Chess(prev.fen());
      try {
        const result = newGame.move({ from, to, promotion: promotion || 'q' });
        if (!result) return prev;
        if (result.captured) playCaptureSound(); else playMoveSound();
        if (newGame.inCheck() && !newGame.isCheckmate()) playCheckSound();
        setLastMove({ from: result.from, to: result.to });
        setHistory(newGame.history({ verbose: true }));
        updateCheckSquare(newGame);
        if (newGame.isCheckmate()) {
          playCheckmateSound();
          setTimerRunning(false);
          setGameOver({ result: newGame.turn() === 'w' ? 'Black wins' : 'White wins', reason: 'Checkmate' });
        } else if (newGame.isDraw()) {
          setTimerRunning(false);
          setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
        }
        return newGame;
      } catch { return prev; }
    });
  }, [updateCheckSquare]);

  const triggerBot = useCallback((fen, depth) => {
    setIsThinking(true);
    setTimeout(() => {
      try {
        const tempGame = new Chess(fen);
        const moves = tempGame.moves({ verbose: true });
        if (!moves.length) { setIsThinking(false); return; }

        const pieceValues = { p:1, n:3, b:3, r:5, q:9, k:0 };

        const scored = moves.map(move => {
          let score = 0;
          if (move.captured) score += pieceValues[move.captured] * 10;
          if (['d4','d5','e4','e5'].includes(move.to)) score += 3;
          if (move.piece === 'p' && (move.to[1] === '7' || move.to[1] === '2')) score += 5;
          score += Math.random() * depth * 2;
          return { move, score };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Phoenix Prime picks from top 3, others pick best
        const poolSize = depth >= 18 ? 3 : 1;
        const pool = scored.slice(0, poolSize);
        const chosen = pool[Math.floor(Math.random() * pool.length)];

        applyBotMove(chosen.move.from, chosen.move.to, chosen.move.promotion);
      } catch {}
      setIsThinking(false);
    }, 400 + Math.random() * 800);
  }, [applyBotMove]);

  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking || promotionMove) return;
    if (!timerRunning && history.length === 0) setTimerRunning(true);

    const turn = game.turn();
    if (turn !== 'w') return;

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        const moves = game.moves({ square: selectedSquare, verbose: true });
        const move = moves.find(m => m.to === square);

        const isPawnPromotion = move?.flags?.includes('p') ||
          (game.get(selectedSquare)?.type === 'p' &&
          ((turn === 'w' && square[1] === '8') || (turn === 'b' && square[1] === '1')));

        if (isPawnPromotion) {
          setPromotionMove({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }

        const newGame = new Chess(game.fen());
        try {
          const result = newGame.move({ from: selectedSquare, to: square });
          if (!result) return;
          if (result.captured) playCaptureSound(); else playMoveSound();
          if (newGame.inCheck() && !newGame.isCheckmate()) playCheckSound();
          setLastMove({ from: result.from, to: result.to });
          setHistory(newGame.history({ verbose: true }));
          setGame(newGame);
          updateCheckSquare(newGame);
          setSelectedSquare(null);
          setLegalMoves([]);
          if (newGame.isCheckmate()) {
            playCheckmateSound();
            setTimerRunning(false);
            setGameOver({ result: 'White wins', reason: 'Checkmate' });
          } else if (newGame.isDraw()) {
            setTimerRunning(false);
            setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
          } else {
            setTimeout(() => triggerBot(newGame.fen(), selectedBot.depth), 300);
          }
        } catch {}
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
  }, [game, selectedSquare, legalMoves, gameOver, isThinking, timerRunning, history, selectedBot, triggerBot, updateCheckSquare, promotionMove]);

  const handlePromotion = (piece) => {
    if (!promotionMove) return;
    const newGame = new Chess(game.fen());
    try {
      const result = newGame.move({ from: promotionMove.from, to: promotionMove.to, promotion: piece });
      if (!result) return;
      if (result.captured) playCaptureSound(); else playMoveSound();
      setLastMove({ from: result.from, to: result.to });
      setHistory(newGame.history({ verbose: true }));
      setGame(newGame);
      updateCheckSquare(newGame);
      setPromotionMove(null);
      if (newGame.isCheckmate()) {
        playCheckmateSound();
        setTimerRunning(false);
        setGameOver({ result: 'White wins', reason: 'Checkmate' });
      } else if (newGame.isDraw()) {
        setTimerRunning(false);
        setGameOver({ result: 'Draw', reason: 'Stalemate or draw rule' });
      } else {
        setTimeout(() => triggerBot(newGame.fen(), selectedBot.depth), 300);
      }
    } catch {}
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
    setWhiteTime(timerMode?.seconds || 600);
    setBlackTime(timerMode?.seconds || 600);
    setTimerRunning(false);
    setIsThinking(false);
    setPromotionMove(null);
    playGameStartSound();
  };

  const handleUndo = () => {
    const newGame = new Chess();
    const hist = game.history();
    hist.slice(0, -2).forEach(m => newGame.move(m));
    setGame(newGame);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    updateCheckSquare(newGame);
    setHistory(newGame.history({ verbose: true }));
    setIsThinking(false);
    setPromotionMove(null);
  };

  if (!selectedBot) {
    return (
      <div className="min-h-screen bg-background flex flex-col font-inter">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Menu</button>
          <h2 className="flex-1 text-center font-bold text-foreground">Choose Your Opponent</h2>
          <div className="w-12" />
        </div>
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
          {BOTS.map(bot => (
            <button key={bot.id} onClick={() => setSelectedBot(bot)}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 hover:border-primary/50 transition-all duration-200 text-left active:scale-[0.98]">
              <span className="text-3xl">{bot.emoji}</span>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{bot.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{bot.label}</span>
                </div>
                <span className="text-xs text-muted-foreground italic">&ldquo;{bot.personality}&rdquo;</span>
              </div>
              <span className="text-muted-foreground">→</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter">
      <GameHeader
        mode="normal"
        onBack={onBack}
        botName={selectedBot.name}
        gameStatus={game.inCheck() && !game.isGameOver() ? '⚠ Check!' : null}
      />

      {promotionMove && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-2xl">
            <h3 className="text-foreground font-bold text-lg mb-4">Choose Promotion</h3>
            <div className="flex gap-3">
              {PROMOTION_PIECES.map(p => (
                <button
                  key={p.value}
                  onClick={() => handlePromotion(p.value)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border bg-secondary hover:bg-primary/20 hover:border-primary transition-all"
                >
                  <img
                    src={PIECE_IMAGES['w' + p.value]}
                    alt={p.name}
                    style={{ width: '48px', height: '48px' }}
                  />
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedBot.emoji}</span>
              <div>
                <span className="text-sm font-bold text-foreground">{selectedBot.name}</span>
                {isThinking && <span className="text-xs text-primary ml-2 animate-pulse">thinking…</span>}
              </div>
            </div>
            <span className="text-xs italic text-muted-foreground">&ldquo;{selectedBot.personality}&rdquo;</span>
          </div>
          <ChessBoard
            game={game}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            checkSquare={checkSquare}
          />
          <div className="flex items-center gap-2 w-full px-1">
            <div className="w-3 h-3 rounded-full bg-white" />
            <span className="text-sm font-bold text-foreground">You (White)</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs lg:max-w-[240px]">
          <GameTimer
            whiteTime={whiteTime}
            blackTime={blackTime}
            activeColor={game.turn()}
            isRunning={timerRunning}
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
          <div className="flex-1 min-h-0" style={{ height: '300px' }}>
            <MoveHistory history={history} />
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
