import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';

import ChessBoard from '../components/chess/ChessBoard';
import MoveHistory from '../components/chess/MoveHistory';
import GameTimer from '../components/chess/GameTimer';
import GameHeader from '../components/chess/GameHeader';
import GameOverModal from '../components/chess/GameOverModal';

import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCheckmateSound,
  playGameStartSound
} from '../lib/chessSounds';

import { createStockfish } from '../engine/stockfishBot';
import { updateGlicko } from '../lib/glicko2';

/* ---------------- BOTS ---------------- */
const BOTS = [
  { id: 'astra', name: 'Astra', emoji: '🌱', depth: 2 },
  { id: 'orion', name: 'Orion', emoji: '⭐', depth: 4 },
  { id: 'titanx', name: 'TitanX', emoji: '⚔️', depth: 6 },
  { id: 'vortex', name: 'Vortex', emoji: '🌪️', depth: 8 },
  { id: 'zenith', name: 'Zenith', emoji: '👑', depth: 10 },
  { id: 'phoenix', name: 'Phoenix Prime', emoji: '🔥', depth: 18 },
];

export default function NormalChess({ timerMode, onBack }) {

  /* ---------------- STATE ---------------- */
  const [selectedBot, setSelectedBot] = useState(null);

  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);

  const [history, setHistory] = useState([]);
  const [pgn, setPgn] = useState([]);

  const [whiteTime, setWhiteTime] = useState(timerMode?.seconds || 600);
  const [blackTime, setBlackTime] = useState(timerMode?.seconds || 600);
  const [timerRunning, setTimerRunning] = useState(false);

  const [isThinking, setIsThinking] = useState(false);
  const [promotionMove, setPromotionMove] = useState(null);

  const [gameOver, setGameOver] = useState(null);

  const [player, setPlayer] = useState({
    rating: 400,
    rd: 350
  });

  const [botRating] = useState(800);

  /* ---------------- ✏️ ANNOTATION SYSTEM ---------------- */
  const [arrows, setArrows] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const drawRef = useRef(null);

  /* ---------------- REFS ---------------- */
  const engineRef = useRef(null);
  const gameRef = useRef(game);
  const botLock = useRef(false);

  gameRef.current = game;

  /* ---------------- ENGINE ---------------- */
  useEffect(() => {
    engineRef.current = createStockfish();

    return () => {
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (selectedBot) playGameStartSound();
  }, [selectedBot]);

  /* ---------------- MOVE APPLY ---------------- */
  const applyMove = useCallback((from, to, promotion) => {
    setGame(prev => {
      const g = new Chess(prev.fen());

      const move = g.move({ from, to, promotion });

      if (!move) return prev;

      if (move.captured) playCaptureSound();
      else playMoveSound();

      if (g.inCheck()) playCheckSound();
      else setCheckSquare(null);

      setLastMove({ from: move.from, to: move.to });

      const h = g.history({ verbose: true });
      setHistory(h);
      setPgn(h.map(m => m.san));

      if (g.isCheckmate()) {
        playCheckmateSound();

        const playerWon = g.turn() === 'b';

        const updated = updateGlicko(
          player,
          { rating: botRating, rd: 350 },
          playerWon ? 1 : 0
        );

        setPlayer(updated);

        setGameOver({
          result: playerWon ? 'White wins' : 'Black wins',
          reason: 'Checkmate'
        });

        setTimerRunning(false);
      }

      return g;
    });
  }, [player, botRating]);

  /* ---------------- BOT ---------------- */
  const triggerBot = useCallback(async (fen, depth) => {
    if (!engineRef.current || botLock.current) return;

    botLock.current = true;
    setIsThinking(true);

    try {
      const best = await engineRef.current.getBestMove(fen, depth, 3);

      if (best) {
        applyMove(
          best.substring(0, 2),
          best.substring(2, 4),
          best[4]
        );
      }

    } catch (e) {
      console.error(e);
    }

    setIsThinking(false);
    botLock.current = false;
  }, [applyMove]);

  /* ---------------- CLICK ---------------- */
  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking) return;

    const g = game;

    if (selectedSquare) {
      const move = g.move({
        from: selectedSquare,
        to: square,
        promotion: 'q'
      });

      if (!move) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      if (move.promotion) {
        setPromotionMove({
          from: selectedSquare,
          to: square,
          fen: g.fen()
        });
        return;
      }

      setGame(new Chess(g.fen()));
      setSelectedSquare(null);
      setLegalMoves([]);

      setTimeout(() => {
        if (selectedBot) {
          triggerBot(g.fen(), selectedBot.depth);
        }
      }, 300);

    } else {
      const piece = g.get(square);

      if (piece?.color === 'w') {
        setSelectedSquare(square);

        setLegalMoves(
          g.moves({ square, verbose: true }).map(m => m.to)
        );
      }
    }
  }, [game, selectedSquare, gameOver, isThinking, selectedBot, triggerBot]);

  /* ---------------- ✏️ DRAW SYSTEM ---------------- */

  const handleDrawStart = (square) => {
    drawRef.current = square;
  };

  const handleDrawEnd = (square) => {
    if (!drawRef.current) return;

    const from = drawRef.current;

    if (from === square) {
      setHighlights(prev => [...prev, square]);
    } else {
      setArrows(prev => [
        ...prev,
        { from, to: square, color: 'rgba(0,150,255,0.6)' }
      ]);
    }

    drawRef.current = null;
  };

  const clearDrawings = () => {
    setArrows([]);
    setHighlights([]);
  };

  /* ---------------- UI ---------------- */
  if (!selectedBot) {
    return (
      <div className="p-4">
        <h2>Choose Bot</h2>

        {BOTS.map(b => (
          <button key={b.id} onClick={() => setSelectedBot(b)}>
            {b.emoji} {b.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      <GameHeader mode="bot" botName={selectedBot.name} onBack={onBack} />

      <ChessBoard
        game={game}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        onSquareClick={handleSquareClick}

        arrows={arrows}
        highlights={highlights}
        onDrawStart={handleDrawStart}
        onDrawEnd={handleDrawEnd}
        clearDrawings={clearDrawings}
      />

      <GameTimer
        whiteTime={whiteTime}
        blackTime={blackTime}
        activeColor={game.turn()}
        isRunning={timerRunning}
      />

      <MoveHistory history={history} />

      <div className="p-2 text-xs">
        Rating: {player.rating}
      </div>

      {/* PROMOTION UI */}
      {promotionMove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white p-4 flex gap-2 rounded-xl">

            {['q','r','b','n'].map(p => (
              <button
                key={p}
                onClick={() => {
                  const g = new Chess(promotionMove.fen);

                  g.move({
                    from: promotionMove.from,
                    to: promotionMove.to,
                    promotion: p
                  });

                  setGame(g);
                  setPromotionMove(null);

                  const h = g.history({ verbose: true });
                  setHistory(h);
                  setPgn(h.map(m => m.san));

                  if (selectedBot) {
                    setTimeout(() =>
                      triggerBot(g.fen(), selectedBot.depth), 300
                    );
                  }
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}

          </div>
        </div>
      )}

      <GameOverModal
        result={gameOver?.result}
        reason={gameOver?.reason}
        onRematch={() => setGame(new Chess())}
        onMenu={onBack}
      />

    </div>
  );
          }
