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

const BOTS = [
  { id: 'astra', name: 'Astra', emoji: '🌱', depth: 2, label: 'Beginner' },
  { id: 'orion', name: 'Orion', emoji: '⭐', depth: 4, label: 'Easy' },
  { id: 'titanx', name: 'TitanX', emoji: '⚔️', depth: 6, label: 'Intermediate' },
  { id: 'vortex', name: 'Vortex', emoji: '🌪️', depth: 8, label: 'Advanced' },
  { id: 'zenith', name: 'Zenith', emoji: '👑', depth: 12, label: 'Master' },
  { id: 'phoenix', name: 'Phoenix Prime', emoji: '🔥', depth: 18, label: 'Maximum' },
];

export default function NormalChess({ timerMode, onBack }) {
  const [selectedBot, setSelectedBot] = useState(null);

  // 🆕 MODE SWITCH (IMPORTANT)
  const [mode, setMode] = useState('bot'); 
  // 'bot' | 'phoenixCore'

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

  const timerRef = useRef(null);
  const gameRef = useRef(game);

  // ⚠️ ENGINE ONLY USED IN BOT MODE
  const engineRef = useRef(null);

  gameRef.current = game;

  useEffect(() => {
    playGameStartSound();
  }, []);

  // 🧠 INIT STOCKFISH ONLY IF BOT MODE
  useEffect(() => {
    if (mode === 'bot') {
      engineRef.current = createStockfish();
    }
  }, [mode]);

  // TIMER
  useEffect(() => {
    if (!timerRunning || gameOver) return;

    timerRef.current = setInterval(() => {
      const turn = gameRef.current.turn();

      if (turn === 'w') {
        setWhiteTime(t => (t <= 1 ? 0 : t - 1));
      } else {
        setBlackTime(t => (t <= 1 ? 0 : t - 1));
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timerRunning, gameOver]);

  const updateCheckSquare = useCallback((g) => {
    if (!g.inCheck()) {
      setCheckSquare(null);
      return;
    }

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
  }, []);

  const applyMove = useCallback((from, to, promotion) => {
    setGame(prev => {
      const newGame = new Chess(prev.fen());

      const result = newGame.move({
        from,
        to,
        promotion
      });

      if (!result) return prev;

      if (result.captured) playCaptureSound();
      else playMoveSound();

      if (newGame.inCheck()) playCheckSound();

      setLastMove({ from, to });
      setHistory(newGame.history({ verbose: true }));
      updateCheckSquare(newGame);

      if (newGame.isCheckmate()) {
        playCheckmateSound();
        setTimerRunning(false);
        setGameOver({ result: 'Game Over', reason: 'Checkmate' });
      }

      return newGame;
    });
  }, [updateCheckSquare]);

  // 🔥 BOT LOGIC (ONLY FOR BOT MODE)
  const triggerBot = useCallback(async (fen, depth) => {
    if (mode !== 'bot') return;   // 🚨 HARD BLOCK

    if (!engineRef.current) return;

    setIsThinking(true);

    try {
      const tempGame = new Chess(fen);
      const moves = tempGame.moves({ verbose: true });

      if (!moves.length) return;

      const best = await engineRef.current.getBestMove(fen, depth, 3);

      const candidates = [best];

      while (candidates.length < 3) {
        const r = moves[Math.floor(Math.random() * moves.length)];
        candidates.push(r.from + r.to + (r.promotion || ''));
      }

      const weights = [0.7, 0.2, 0.1];
      const rand = Math.random();

      let index = 0;
      if (rand > weights[0]) index = 1;
      if (rand > weights[0] + weights[1]) index = 2;

      const chosen = candidates[index] || candidates[0];

      applyMove(
        chosen.substring(0, 2),
        chosen.substring(2, 4),
        chosen[4]
      );

    } catch (e) {
      console.error(e);
    }

    setIsThinking(false);
  }, [applyMove, mode]);

  const handleSquareClick = useCallback((square) => {
    if (gameOver || isThinking) return;

    const turn = game.turn();

    if (selectedSquare) {
      const moves = game.moves({ square: selectedSquare, verbose: true });
      const move = moves.find(m => m.to === square);

      const newGame = new Chess(game.fen());

      const result = newGame.move({
        from: selectedSquare,
        to: square,
        promotion: move?.flags?.includes('p') ? 'q' : undefined
      });

      if (!result) return;

      applyMove(result.from, result.to, result.promotion);

      setSelectedSquare(null);
      setLegalMoves([]);

      updateCheckSquare(newGame);

      // 🚨 ONLY BOT MODE TRIGGERS ENGINE
      if (mode === 'bot') {
        setTimeout(() => {
          triggerBot(newGame.fen(), selectedBot.depth);
        }, 400);
      }

    } else {
      const piece = game.get(square);
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        setLegalMoves(game.moves({ square, verbose: true }).map(m => m.to));
      }
    }
  }, [game, selectedSquare, isThinking, gameOver, triggerBot, selectedBot, mode, applyMove, updateCheckSquare]);

  const handleRestart = () => {
    setGame(new Chess());
    setSelectedSquare(null);
    setLegalMoves([]);
    setHistory([]);
    setGameOver(null);
    setIsThinking(false);
    setWhiteTime(timerMode?.seconds || 600);
    setBlackTime(timerMode?.seconds || 600);
    setTimerRunning(false);
  };

  // 🧠 MODE SELECT SCREEN
  if (!selectedBot) {
    return (
      <div className="p-4">
        <h2>Select Mode</h2>

        <button onClick={() => setMode('bot')}>
          Bot Mode
        </button>

        <button onClick={() => setMode('phoenixCore')}>
          Phoenix Core (2 Player)
        </button>

        <hr />

        {BOTS.map(bot => (
          <button key={bot.id} onClick={() => setSelectedBot(bot)}>
            {bot.emoji} {bot.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <GameHeader onBack={onBack} botName={selectedBot.name} />

      <ChessBoard
        game={game}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        onSquareClick={handleSquareClick}
        checkSquare={checkSquare}
      />

      <GameTimer
        whiteTime={whiteTime}
        blackTime={blackTime}
        activeColor={game.turn()}
        isRunning={timerRunning}
      />

      <MoveHistory history={history} />

      <GameOverModal
        result={gameOver?.result}
        reason={gameOver?.reason}
        onRematch={handleRestart}
        onMenu={onBack}
      />
    </div>
  );
          }
