/**
 * AnalysisBoard.jsx - Main analysis mode component
 * 
 * Features:
 * - Play both sides locally or offline
 * - Real-time Stockfish analysis
 * - Move classification
 * - Coach explanations
 * - Position setup
 */

import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import StockfishEngine from './Engine/StockfishEngine';
import MoveClassifier from './Engine/MoveClassifier';

export default function AnalysisBoard() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [engine, setEngine] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [moveIndex, setMoveIndex] = useState(-1);
  const [analysis, setAnalysis] = useState([]);
  const [settings, setSettings] = useState({
    showEvalBar: true,
    showEvalValue: true,
    showExplanations: true,
    coachMode: 'default', // 'default', 'serious', 'meme'
    coachEnabled: false
  });
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [gameMode, setGameMode] = useState('local'); // 'local' or 'multiplayer'

  // Initialize Stockfish
  useEffect(() => {
    const initEngine = async () => {
      try {
        const stockfish = new StockfishEngine();
        await stockfish.init();
        setEngine(stockfish);
        console.log('✅ Stockfish engine initialized');
      } catch (err) {
        console.error('❌ Failed to initialize Stockfish:', err);
        alert('Chess engine failed to load. Analysis features disabled.');
      }
    };

    initEngine();

    return () => {
      if (engine) engine.terminate();
    };
  }, []);

  // Handle moves with analysis
  const handleMove = async (move) => {
    if (game.isGameOver() && gameMode === 'local') {
      // Game over - start analysis
      setMoveIndex(game.history().length - 1);
      return;
    }

    const result = game.move(move);
    if (!result) return false;

    // Update game state
    const newGame = game;
    setFen(newGame.fen());

    // Analyze the move
    if (engine && settings.showExplanations) {
      setIsAnalyzing(true);
      try {
        const moveAnalysis = await engine.analyzeMove(
          newGame.fen(),
          move,
          20 // depth
        );
        
        const explanation = MoveClassifier.getCoachExplanation(
          moveAnalysis.classification,
          moveAnalysis.evalDiff,
          move,
          settings.coachMode
        );

        analysis.push({
          move,
          ...moveAnalysis,
          explanation,
          tacticalPatterns: MoveClassifier.detectTacticalPattern(fen, move)
        });

        setAnalysis(analysis);
      } catch (err) {
        console.error('Analysis error:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }

    return true;
  };

  // Navigate moves during review
  const goToPreviousMove = () => {
    if (moveIndex > 0) {
      setMoveIndex(moveIndex - 1);
      // Replay game up to this move
      const newGame = new Chess();
      const history = game.history();
      for (let i = 0; i <= moveIndex - 1; i++) {
        newGame.move(history[i]);
      }
      setFen(newGame.fen());
    }
  };

  const goToNextMove = () => {
    if (moveIndex < game.history().length - 1) {
      setMoveIndex(moveIndex + 1);
      const newGame = new Chess();
      const history = game.history();
      for (let i = 0; i <= moveIndex + 1; i++) {
        newGame.move(history[i]);
      }
      setFen(newGame.fen());
    }
  };

  // Export PGN
  const exportPGN = () => {
    const pgn = game.pgn();
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(pgn));
    element.setAttribute('download', `game_${Date.now()}.pgn`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Import PGN
  const importPGN = (pgnText) => {
    const newGame = new Chess();
    newGame.loadPgn(pgnText);
    setGame(newGame);
    setFen(newGame.fen());
    setAnalysis([]);
    setMoveIndex(-1);
  };

  return (
    <div className="analysis-mode">
      {/* Board Section */}
      <div className="analysis-board-container">
        <Chessboard
          position={fen}
          onPieceDrop={handleMove}
          customBoardStyle={{ borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
        />

        {/* Navigation Controls */}
        <div className="move-navigation">
          <button onClick={goToPreviousMove} disabled={moveIndex <= 0}>
            ⬅️ Previous
          </button>
          <span>{moveIndex + 1} / {game.history().length}</span>
          <button onClick={goToNextMove} disabled={moveIndex >= game.history().length - 1}>
            Next ➡️
          </button>
        </div>
      </div>

      {/* Analysis Panel */}
      <div className="analysis-panel">
        {/* Evaluation Bar */}
        {settings.showEvalBar && analysis.length > 0 && (
          <div className="eval-bar">
            <div className="eval-value">
              {analysis[moveIndex]?.moveEval.toFixed(2)}
            </div>
            <div className="eval-bar-fill" 
              style={{
                width: `${50 + (analysis[moveIndex]?.moveEval * 10)}%`,
                backgroundColor: analysis[moveIndex]?.moveEval > 0 ? '#4CAF50' : '#f44336'
              }}
            />
          </div>
        )}

        {/* Coach Explanation */}
        {settings.showExplanations && analysis[moveIndex] && (
          <div className="coach-explanation">
            <h4>{analysis[moveIndex].classification}</h4>
            <p>{analysis[moveIndex].explanation}</p>
            {settings.coachEnabled && (
              <button onClick={() => speak(analysis[moveIndex].explanation)}>
                🔊 Read Aloud
              </button>
            )}
          </div>
        )}

        {/* Settings */}
        <div className="analysis-settings">
          <label>
            <input
              type="checkbox"
              checked={settings.showEvalBar}
              onChange={(e) => setSettings({...settings, showEvalBar: e.target.checked})}
            />
            Show Eval Bar
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.showEvalValue}
              onChange={(e) => setSettings({...settings, showEvalValue: e.target.checked})}
            />
            Show Eval Value
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.showExplanations}
              onChange={(e) => setSettings({...settings, showExplanations: e.target.checked})}
            />
            Show Explanations
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.coachEnabled}
              onChange={(e) => setSettings({...settings, coachEnabled: e.target.checked})}
            />
            Coach Mode
          </label>
          {settings.coachEnabled && (
            <select 
              value={settings.coachMode}
              onChange={(e) => setSettings({...settings, coachMode: e.target.value})}
            >
              <option value="default">Normal Coach</option>
              <option value="serious">Serious Coach</option>
              <option value="meme">Meme Coach 😂</option>
            </select>
          )}
        </div>

        {/* PGN Import/Export */}
        <div className="pgn-controls">
          <button onClick={exportPGN}>📥 Export PGN</button>
          <input
            type="file"
            accept=".pgn"
            onChange={(e) => {
              const file = e.target.files[0];
              const reader = new FileReader();
              reader.onload = (event) => importPGN(event.target.result);
              reader.readAsText(file);
            }}
          />
        </div>

        {/* Position Setup */}
        {isSetupMode && (
          <div className="position-setup">
            <h4>⚙️ Set Up Position</h4>
            <p>Click squares to place/remove pieces</p>
            <button onClick={() => setIsSetupMode(false)}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Text-to-speech helper
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  speechSynthesis.speak(utterance);
            }
