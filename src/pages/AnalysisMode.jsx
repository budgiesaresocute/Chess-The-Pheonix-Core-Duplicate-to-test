import React, {
  useState,
  useRef,
  useEffect,
} from 'react';

import { Chess } from 'chess.js';

import { parsePgn } from '../lib/pgnParser';

import {
  analyzeGame,
  COACH_PERSONAS,
  CLASSIFICATION_COLOR,
  CLASSIFICATION_EMOJI,
} from '../lib/gameAnalysis';

import {
  initEngine,
  evaluatePosition,
} from '../lib/stockfishEngine';

export default function AnalysisMode({
  onBack,
}) {
  const [pgn, setPgn] = useState('');

  const [loading, setLoading] =
    useState(false);

  const [loadingText, setLoadingText] =
    useState('');

  const [gameState, setGameState] =
    useState('upload');

  const [uploadedGame, setUploadedGame] =
    useState(null);

  const [analysis, setAnalysis] =
    useState(null);

  const [
    currentMoveIndex,
    setCurrentMoveIndex,
  ] = useState(0);

  const [selectedCoach, setSelectedCoach] =
    useState('FRIENDLY');

  const fileInputRef = useRef(null);

  useEffect(() => {
    initEngine();
  }, []);

  async function handlePgnUpload() {
    try {
      setLoading(true);

      const parsed = parsePgn(pgn);

      const analyzedMoves = [];

      const chess = new Chess();

      for (
        let i = 0;
        i < parsed.history.length;
        i++
      ) {
        setLoadingText(
          `Analyzing move ${
            i + 1
          } / ${parsed.history.length}`
        );

        const move =
          parsed.history[i];

        // =========================
        // POSITION BEFORE MOVE
        // =========================

        const beforeFen =
          chess.fen();

        const beforeEval =
          await evaluatePosition(
            beforeFen,
            10
          );

        // =========================
        // PLAY ACTUAL MOVE
        // =========================

        chess.move(move);

        // =========================
        // POSITION AFTER MOVE
        // =========================

        const afterFen =
          chess.fen();

        const afterEval =
          await evaluatePosition(
            afterFen,
            10
          );

        // =========================
        // EVAL LOSS
        // =========================

        const bestEval =
          beforeEval.eval;

        const playedEval =
          afterEval.eval;

        analyzedMoves.push({
          ...move,

          prevEval:
            i === 0
              ? 0
              : analyzedMoves[i - 1]
                  .playedEval,

          bestEval,
          playedEval,

          bestMove:
            beforeEval.bestMove,

          pv:
            beforeEval.pv,

          mate:
            afterEval.mate,

          legalMoves:
            chess.moves().length,
        });
      }

      // =========================
      // FINAL GAME ANALYSIS
      // =========================

      const analysisResult =
        analyzeGame(analyzedMoves);

      setUploadedGame({
        ...parsed,
        moveHistory: analyzedMoves,
      });

      setAnalysis(analysisResult);

      setGameState('analysis');
    } catch (err) {
      console.error(err);

      alert(
        err.message ||
          'Failed to analyze PGN'
      );
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  }

  // =====================================
  // UPLOAD SCREEN
  // =====================================

  if (gameState === 'upload') {
    return (
      <div
        style={{
          padding: 30,
          backgroundColor: '#111',
          color: 'white',
          minHeight: '100vh',
        }}
      >
        <button
          onClick={onBack}
          style={{
            marginBottom: 20,
            padding: '10px 16px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            fontSize: 40,
            marginBottom: 10,
          }}
        >
          📊 Professional Analysis
        </h1>

        <p
          style={{
            color: '#aaa',
            marginBottom: 20,
          }}
        >
          Upload a PGN and analyze
          with Stockfish
        </p>

        <textarea
          value={pgn}
          onChange={(e) =>
            setPgn(e.target.value)
          }
          placeholder='Paste PGN here...'
          style={{
            width: '100%',
            height: 250,
            padding: 15,
            backgroundColor: '#222',
            color: 'white',
            border: '1px solid #444',
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 14,
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            onClick={handlePgnUpload}
            disabled={loading}
            style={{
              padding: '12px 20px',
              backgroundColor: '#00cc66',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {loading
              ? loadingText
              : 'Analyze Game'}
          </button>

          <button
            onClick={() =>
              fileInputRef.current?.click()
            }
            style={{
              padding: '12px 20px',
              backgroundColor: '#333',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Upload PGN
          </button>

          <input
            ref={fileInputRef}
            type='file'
            accept='.pgn,.txt'
            style={{ display: 'none' }}
            onChange={(e) => {
              const file =
                e.target.files[0];

              if (!file) return;

              const reader =
                new FileReader();

              reader.onload = (
                event
              ) => {
                setPgn(
                  event.target.result
                );
              };

              reader.readAsText(file);
            }}
          />
        </div>
      </div>
    );
  }

  // =====================================
  // LOADING
  // =====================================

  if (!uploadedGame || !analysis) {
    return null;
  }

  const move =
    uploadedGame.moveHistory[
      currentMoveIndex
    ];

  const coach =
    COACH_PERSONAS[
      selectedCoach
    ];

  // =====================================
  // ANALYSIS SCREEN
  // =====================================

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '2fr 1fr',
        gap: 20,
        padding: 20,
        backgroundColor: '#111',
        color: 'white',
        minHeight: '100vh',
      }}
    >
      {/* LEFT SIDE */}

      <div>
        <button
          onClick={() => {
            setGameState('upload');
            setAnalysis(null);
            setUploadedGame(null);
            setCurrentMoveIndex(0);
          }}
          style={{
            marginBottom: 20,
            padding: '10px 16px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>

        <h2>
          Move{' '}
          {currentMoveIndex + 1}
        </h2>

        <div
          style={{
            fontSize: 36,
            fontWeight: 'bold',
            marginTop: 10,
          }}
        >
          {move.san}
        </div>

        <div
          style={{
            color:
              CLASSIFICATION_COLOR[
                move.classification
              ],
            fontWeight: 'bold',
            marginTop: 10,
            fontSize: 22,
          }}
        >
          {
            CLASSIFICATION_EMOJI[
              move.classification
            ]
          }{' '}
          {move.classification}
        </div>

        <div
          style={{
            marginTop: 25,
            backgroundColor: '#222',
            padding: 20,
            borderRadius: 10,
          }}
        >
          <div>
            <strong>
              Played Eval:
            </strong>{' '}
            {move.playedEval}
          </div>

          <div
            style={{
              marginTop: 10,
            }}
          >
            <strong>
              Best Eval:
            </strong>{' '}
            {move.bestEval}
          </div>

          <div
            style={{
              marginTop: 10,
            }}
          >
            <strong>
              Best Move:
            </strong>{' '}
            {move.bestMove}
          </div>

          <div
            style={{
              marginTop: 10,
            }}
          >
            <strong>PV:</strong>{' '}
            {move.pv}
          </div>

          {move.mate && (
            <div
              style={{
                marginTop: 10,
                color: '#ff4444',
                fontWeight:
                  'bold',
              }}
            >
              Mate in {move.mate}
            </div>
          )}
        </div>

        {/* NAVIGATION */}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            disabled={
              currentMoveIndex === 0
            }
            onClick={() =>
              setCurrentMoveIndex(
                currentMoveIndex - 1
              )
            }
          >
            ⬅ Prev
          </button>

          <button
            disabled={
              currentMoveIndex ===
              uploadedGame
                .moveHistory.length -
                1
            }
            onClick={() =>
              setCurrentMoveIndex(
                currentMoveIndex + 1
              )
            }
          >
            Next ➜
          </button>
        </div>
      </div>

      {/* RIGHT SIDE */}

      <div>
        {/* ACCURACY */}

        <div
          style={{
            backgroundColor: '#222',
            padding: 20,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <h2>Accuracy</h2>

          <h1
            style={{
              fontSize: 50,
            }}
          >
            {analysis.accuracy}%
          </h1>

          <p>
            ACPL:{' '}
            {analysis.acpl}
          </p>
        </div>

        {/* COACH */}

        <div
          style={{
            backgroundColor: '#222',
            padding: 20,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <h2>Coach</h2>

          <div
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: 10,
              marginTop: 20,
            }}
          >
            {Object.entries(
              COACH_PERSONAS
            ).map(
              ([
                key,
                value,
              ]) => (
                <button
                  key={key}
                  onClick={() =>
                    setSelectedCoach(
                      key
                    )
                  }
                  style={{
                    padding:
                      '10px 12px',
                    backgroundColor:
                      selectedCoach ===
                      key
                        ? '#00B0FF'
                        : '#333',
                    color:
                      selectedCoach ===
                      key
                        ? 'black'
                        : 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight:
                      'bold',
                  }}
                >
                  {value.emoji}{' '}
                  {value.name}
                </button>
              )
            )}
          </div>

          <div
            style={{
              marginTop: 20,
              lineHeight: 1.6,
              color: '#ccc',
            }}
          >
            {coach.getComment(
              analysis
            )}
          </div>
        </div>

        {/* BRILLIANT MOVES */}

        <div
          style={{
            backgroundColor: '#222',
            padding: 20,
            borderRadius: 10,
          }}
        >
          <h2>
            💎 Brilliant Moves
          </h2>

          {analysis.brilliantMoves
            .length === 0 && (
            <p
              style={{
                color: '#888',
              }}
            >
              No brilliant moves
            </p>
          )}

          {analysis.brilliantMoves.map(
            (move, index) => (
              <div
                key={index}
                style={{
                  marginTop: 10,
                }}
              >
                💎 Move{' '}
                {move.turn}:{' '}
                {move.move}
              </div>
            )
          )}

          <h2
            style={{
              marginTop: 30,
            }}
          >
            💥 Blunders
          </h2>

          {analysis.blunders.length ===
            0 && (
            <p
              style={{
                color: '#888',
              }}
            >
              No blunders
            </p>
          )}

          {analysis.blunders.map(
            (move, index) => (
              <div
                key={index}
                style={{
                  marginTop: 10,
                }}
              >
                💥 Move{' '}
                {move.turn}:{' '}
                {move.move}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
            }
