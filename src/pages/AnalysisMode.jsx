import React, { useState, useRef } from 'react';
import { Chess } from 'chess.js';

export default function AnalysisMode({ onBack }) {
  const [gameState, setGameState] = useState('upload'); // upload, analyzing
  const [pgn, setPgn] = useState('');
  const [uploadedGame, setUploadedGame] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedCoach, setSelectedCoach] = useState('FRIENDLY');
  const [gameNotes, setGameNotes] = useState({});
  const fileInputRef = useRef(null);

  const handlePgnUpload = () => {
    if (!pgn.trim()) {
      alert('Please paste a PGN');
      return;
    }

    try {
      const game = new Chess();
      const lines = pgn.split('\n');
      const movesLine = lines.find(l => !l.startsWith('['));
      
      if (movesLine) {
        const moves = movesLine.trim().split(/\s+/);
        const moveHistory = [];
        
        for (const move of moves) {
          if (move === '*' || move.includes('/')) continue;
          const result = game.move(move, { sloppy: true });
          if (result) {
            moveHistory.push(result);
          }
        }

        setUploadedGame({
          pgn,
          moveHistory,
          fen: game.fen(),
          result: moves[moves.length - 1] || '*'
        });
        setGameState('analyzing');
        setCurrentMoveIndex(0);
      }
    } catch (e) {
      alert('Invalid PGN format: ' + e.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPgn(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  // COACH PERSONALITIES
  const coaches = {
    BRUTAL: {
      name: '🔥 Brutal Coach',
      getComment: (moveHistory) => {
        const blunders = moveHistory.filter(m => m.blunders > 0).length;
        if (blunders > 5) return `You made ${blunders} blunders. Time to study the basics.`;
        if (moveHistory.length < 20) return 'Short game. Need more analysis.';
        return 'Your play was inconsistent. Work on consistency.';
      }
    },
    FRIENDLY: {
      name: '😊 Friendly Coach',
      getComment: (moveHistory) => {
        if (moveHistory.length > 40) return 'Great game! You showed good endgame technique.';
        if (moveHistory.length > 20) return 'Good effort! You had some solid moments.';
        return 'Not bad! Everyone makes mistakes. Learn from them!';
      }
    },
    MEME: {
      name: '🤡 Meme Coach',
      getComment: (moveHistory) => {
        if (moveHistory.length > 50) return 'POV: You actually played a long game 📺';
        if (moveHistory.length < 10) return 'Speedrun chess any% 💨';
        return 'It\'s chess, not checkers my friend 😅';
      }
    },
    ANALYTICAL: {
      name: '🧠 Analytical Coach',
      getComment: (moveHistory) => {
        const avgMoves = Math.round(moveHistory.length / 2);
        return `Total moves: ${moveHistory.length} (${avgMoves} per player). Good sample size for analysis.`;
      }
    }
  };

  if (gameState === 'upload') {
    return (
      <div style={{
        padding: 30,
        maxWidth: 900,
        margin: '0 auto',
        backgroundColor: '#1a1a1a',
        color: 'white',
        minHeight: '100vh',
      }}>
        <button
          onClick={onBack}
          style={{
            marginBottom: 20,
            padding: '8px 16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ← Back to Menu
        </button>

        <h1 style={{ marginBottom: 10, fontSize: 40, fontWeight: 'bold' }}>📊 Game Analysis</h1>
        <p style={{ marginBottom: 30, color: '#888' }}>Upload a PGN and analyze your games move by move</p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          marginBottom: 20,
        }}>
          {/* PASTE PGN */}
          <div style={{
            backgroundColor: '#222',
            padding: 20,
            borderRadius: 10,
            border: '2px solid #00cc00',
          }}>
            <h2 style={{ marginBottom: 15, fontSize: 18, fontWeight: 'bold' }}>📝 Paste PGN</h2>
            
            <textarea
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={`[Event "Game"]
[White "Player1"]
[Black "Player2"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4...`}
              style={{
                width: '100%',
                height: 200,
                padding: 10,
                backgroundColor: '#333',
                color: 'white',
                border: '1px solid #444',
                borderRadius: 6,
                fontFamily: 'monospace',
                marginBottom: 10,
                fontSize: 12,
                resize: 'vertical',
              }}
            />
            <button
              onClick={handlePgnUpload}
              style={{
                width: '100%',
                padding: '12px 20px',
                backgroundColor: '#00cc00',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 14,
              }}
            >
              ✅ Analyze PGN
            </button>
          </div>

          {/* UPLOAD FILE */}
          <div style={{
            backgroundColor: '#222',
            padding: 20,
            borderRadius: 10,
            border: '2px solid #ff9900',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: 40, marginBottom: 15 }}>📁</div>
            <h2 style={{ marginBottom: 10, fontSize: 18, fontWeight: 'bold' }}>Upload PGN File</h2>
            <p style={{ color: '#888', fontSize: 12 }}>Click to choose a .pgn file from your device</p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#222',
          padding: 15,
          borderRadius: 8,
          borderLeft: '4px solid #00ccff',
        }}>
          <h3 style={{ marginBottom: 10, fontWeight: 'bold' }}>💡 Supported Sources:</h3>
          <ul style={{ marginLeft: 20, color: '#aaa', fontSize: 14 }}>
            <li>Chess.com games</li>
            <li>Lichess games</li>
            <li>Any PGN format</li>
            <li>Standard chess notation</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!uploadedGame) {
    return <div style={{ padding: 20, color: 'white', textAlign: 'center' }}>Loading...</div>;
  }

  const currentMove = uploadedGame.moveHistory[currentMoveIndex];
  const coach = coaches[selectedCoach];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 20,
      padding: 20,
      maxWidth: 1400,
      margin: '0 auto',
      backgroundColor: '#1a1a1a',
      color: 'white',
      minHeight: '100vh',
    }}>
      {/* LEFT: BOARD & MOVES */}
      <div>
        <button
          onClick={() => {
            setGameState('upload');
            setPgn('');
            setUploadedGame(null);
          }}
          style={{
            marginBottom: 15,
            padding: '8px 16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ← Back
        </button>

        {/* GAME INFO */}
        <div style={{
          backgroundColor: '#222',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
          borderLeft: '4px solid #00cc00',
        }}>
          <h2 style={{ marginBottom: 10, fontWeight: 'bold', fontSize: 16 }}>Game Info</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: '#aaa' }}>
            <div><strong>Total Moves:</strong> {uploadedGame.moveHistory.length}</div>
            <div><strong>Current:</strong> Move {currentMoveIndex + 1}</div>
          </div>
        </div>

        {/* CURRENT MOVE */}
        <div style={{
          backgroundColor: '#222',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
          borderLeft: '4px solid #00ccff',
        }}>
          <h2 style={{ marginBottom: 10, fontWeight: 'bold', fontSize: 16 }}>Move {currentMoveIndex + 1}</h2>
          {currentMove && (
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#00ff00' }}>
                {currentMove.san}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                From: {currentMove.from} → To: {currentMove.to}
              </div>
              {currentMove.captured && (
                <div style={{ fontSize: 12, color: '#ff6600', marginTop: 5 }}>
                  ⚔️ Captured: {currentMove.captured.toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* NOTES */}
        <div style={{
          backgroundColor: '#222',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <h3 style={{ marginBottom: 10, fontWeight: 'bold' }}>📝 Your Notes:</h3>
          <textarea
            value={gameNotes[currentMoveIndex] || ''}
            onChange={(e) => setGameNotes({
              ...gameNotes,
              [currentMoveIndex]: e.target.value,
            })}
            placeholder="Add notes about this move..."
            style={{
              width: '100%',
              height: 100,
              padding: 10,
              backgroundColor: '#333',
              color: 'white',
              border: '1px solid #444',
              borderRadius: 6,
              fontFamily: 'Arial',
              fontSize: 12,
              resize: 'vertical',
            }}
          />
        </div>

        {/* NAVIGATION */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
          marginBottom: 20,
        }}>
          <button
            onClick={() => setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1))}
            disabled={currentMoveIndex === 0}
            style={{
              padding: '10px 15px',
              backgroundColor: currentMoveIndex === 0 ? '#444' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: currentMoveIndex === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: currentMoveIndex === 0 ? 0.5 : 1,
            }}
          >
            ⬅ Prev
          </button>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#222',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 12,
          }}>
            {currentMoveIndex + 1} / {uploadedGame.moveHistory.length}
          </div>
          <button
            onClick={() => setCurrentMoveIndex(Math.min(uploadedGame.moveHistory.length - 1, currentMoveIndex + 1))}
            disabled={currentMoveIndex === uploadedGame.moveHistory.length - 1}
            style={{
              padding: '10px 15px',
              backgroundColor: currentMoveIndex === uploadedGame.moveHistory.length - 1 ? '#444' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: currentMoveIndex === uploadedGame.moveHistory.length - 1 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: currentMoveIndex === uploadedGame.moveHistory.length - 1 ? 0.5 : 1,
            }}
          >
            Next ➜
          </button>
        </div>
      </div>

      {/* RIGHT: COACH PANEL */}
      <div>
        {/* COACH SELECTION */}
        <div style={{
          backgroundColor: '#222',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
          border: '1px solid #444',
        }}>
          <h3 style={{ marginBottom: 15, fontWeight: 'bold', fontSize: 16 }}>🎓 Coach Mode</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(coaches).map(([key, coachData]) => (
              <button
                key={key}
                onClick={() => setSelectedCoach(key)}
                style={{
                  padding: '12px 12px',
                  backgroundColor: selectedCoach === key ? '#00ccff' : '#333',
                  color: selectedCoach === key ? '#000' : 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: selectedCoach === key ? 'bold' : 'normal',
                  fontSize: 12,
                  transition: 'all 0.2s',
                  textAlign: 'left',
                }}
              >
                {coachData.name}
              </button>
            ))}
          </div>
        </div>

        {/* COACH COMMENT */}
        <div style={{
          backgroundColor: '#1a3a52',
          border: '2px solid #00ccff',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <h3 style={{ marginBottom: 10, fontWeight: 'bold', fontSize: 16 }}>
            {coach.name}
          </h3>
          <p style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: '#ccc',
            fontStyle: 'italic',
          }}>
            "{coach.getComment(uploadedGame.moveHistory)}"
          </p>
        </div>

        {/* EXPORT BUTTON */}
        <button
          onClick={() => {
            const data = JSON.stringify({
              pgn: uploadedGame.pgn,
              moveHistory: uploadedGame.moveHistory,
              notes: gameNotes,
              exportDate: new Date().toISOString(),
            }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chess-analysis-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            width: '100%',
            padding: 12,
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 14,
          }}
        >
          📥 Export Analysis
        </button>
      </div>
    </div>
  );
                                                                                            }
