// src/pages/AnalysisMode.jsx

import React, {
  useState,
  useRef,
  useEffect,
} from 'react';

import { Chess } from 'chess.js';

import { Chessboard }
from 'react-chessboard';

import { parsePgn }
from '../lib/pgnParser';

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
  const [pgn, setPgn] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [gameState, setGameState] =
    useState('upload');

  const [uploadedGame,
    setUploadedGame] =
    useState(null);

  const [analysis,
    setAnalysis] =
    useState(null);

  const [
    currentMoveIndex,
    setCurrentMoveIndex,
  ] = useState(0);

  const [
    selectedCoach,
    setSelectedCoach,
  ] = useState(
    'FRIENDLY'
  );

  const [
    gameNotes,
    setGameNotes,
  ] = useState({});

  const [
    analysisBoard,
    setAnalysisBoard,
  ] = useState(
    new Chess()
  );

  const fileInputRef =
    useRef(null);

  useEffect(() => {
    initEngine();
  }, []);

  async function analyzeCurrentPosition() {
    const fen =
      analysisBoard.fen();

    const result =
      await evaluatePosition(
        fen,
        12
      );

    alert(
`Best Move: ${result.bestMove}

Eval: ${result.eval}

PV:
${result.pv}`
    );
  }

  async function handlePgnUpload() {
    try {
      if (!pgn.trim()) {
        alert(
          'Please paste a PGN'
        );

        return;
      }

      setLoading(true);

      const parsed =
        parsePgn(pgn);

      const analyzedMoves =
        [];

      const chess =
        new Chess();

      for (
        let i = 0;
        i <
        parsed.history.length;
        i++
      ) {
        const move =
          parsed.history[i];

        // BEFORE MOVE

        const beforeFen =
          chess.fen();

        const beforeEval =
          await evaluatePosition(
            beforeFen,
            10
          );

        const legalMoves =
          chess.moves()
            .length;

        // PLAY MOVE

        chess.move(move);

        // AFTER MOVE

        const afterFen =
          chess.fen();

        const afterEval =
          await evaluatePosition(
            afterFen,
            10
          );

        analyzedMoves.push({
          ...move,

          prevEval:
            i === 0
              ? 0
              : analyzedMoves[
                  i - 1
                ]
                  .playedEval,

          bestEval:
            beforeEval.eval,

          playedEval:
            afterEval.eval,

          bestMove:
            beforeEval.bestMove,

          pv:
            beforeEval.pv,

          mate:
            afterEval.mate,

          legalMoves,
        });
      }

      const analysisResult =
        analyzeGame(
          analyzedMoves
        );

      setUploadedGame({
        ...parsed,
        moveHistory:
          analyzedMoves,
      });

      setAnalysis(
        analysisResult
      );

      setCurrentMoveIndex(
        0
      );

      setGameState(
        'analysis'
      );
    } catch (err) {
      console.error(err);

      alert(
        err.message ||
          'Failed to analyze PGN'
      );
    } finally {
      setLoading(false);
    }
  }

  // ======================
  // UPLOAD SCREEN
  // ======================

  if (
    gameState === 'upload'
  ) {
    return (
      <div
        style={{
          padding: 30,
          backgroundColor:
            '#111',
          color: 'white',
          minHeight:
            '100vh',
          maxWidth: 1200,
          margin:
            '0 auto',
        }}
      >
        <button
          onClick={onBack}
        >
          ← Back
        </button>

        <h1>
          📊 Professional
          Chess Analysis
        </h1>

        <textarea
          value={pgn}
          onChange={(e) =>
            setPgn(
              e.target.value
            )
          }
          placeholder='Paste PGN here...'
          style={{
            width: '100%',
            height: 250,
            marginTop: 20,
            background:
              '#222',
            color: 'white',
            border:
              '1px solid #444',
            padding: 15,
          }}
        />

        <div
          style={{
            marginTop: 20,
            display: 'flex',
            gap: 10,
            flexWrap:
              'wrap',
          }}
        >
          <button
            onClick={
              handlePgnUpload
            }
            disabled={
              loading
            }
          >
            {loading
              ? 'Analyzing...'
              : 'Analyze PGN'}
          </button>

          <button
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            Upload PGN
          </button>

          <button
            onClick={
              analyzeCurrentPosition
            }
          >
            Analyze Current
            Board
          </button>

          <input
            ref={
              fileInputRef
            }
            type='file'
            accept='.pgn,.txt'
            style={{
              display:
                'none',
            }}
            onChange={(
              e
            ) => {
              const file =
                e.target
                  .files[0];

              if (
                !file
              )
                return;

              const reader =
                new FileReader();

              reader.onload =
                (
                  event
                ) => {
                  setPgn(
                    event
                      .target
                      .result
                  );
                };

              reader.readAsText(
                file
              );
            }}
          />
        </div>

        <div
          style={{
            marginTop: 40,
          }}
        >
          <Chessboard
            position={
              analysisBoard.fen()
            }
            onPieceDrop={(
              sourceSquare,
              targetSquare
            ) => {
              const move =
                analysisBoard.move({
                  from:
                    sourceSquare,
                  to:
                    targetSquare,
                  promotion:
                    'q',
                });

              if (
                move ===
                null
              )
                return false;

              setAnalysisBoard(
                new Chess(
                  analysisBoard.fen()
                )
              );

              return true;
            }}
          />
        </div>
      </div>
    );
  }

  // ======================
  // ANALYSIS SCREEN
  // ======================

  if (
    !uploadedGame ||
    !analysis
  ) {
    return null;
  }

  const move =
    uploadedGame
      .moveHistory[
      currentMoveIndex
    ];

  const coach =
    COACH_PERSONAS[
      selectedCoach
    ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '2fr 1fr',
        gap: 20,
        padding: 20,
        background:
          '#111',
        color: 'white',
        minHeight:
          '100vh',
      }}
    >
      {/* LEFT */}

      <div>
        <Chessboard
          position={
            uploadedGame
              .fenHistory[
              currentMoveIndex
            ]
          }
        />

        <div
          style={{
            marginTop: 20,
            background:
              '#1c1c1c',
            padding: 20,
            borderRadius: 10,
          }}
        >
          <h2>
            {move.san}
          </h2>

          <div
            style={{
              color:
                CLASSIFICATION_COLOR[
                  move
                    .classification
                ],
              fontSize: 24,
              fontWeight:
                'bold',
            }}
          >
            {
              CLASSIFICATION_EMOJI[
                move
                  .classification
              ]
            }

            {' '}

            {
              move.classification
            }
          </div>

          <div
            style={{
              marginTop: 15,
              lineHeight: 2,
            }}
          >
            <div>
              Eval:
              {' '}
              {
                move.playedEval
              }
            </div>

            <div>
              Best Move:
              {' '}
              {
                move.bestMove
              }
            </div>

            <div>
              PV:
              {' '}
              {move.pv}
            </div>

            {move.mate !==
              null && (
              <div>
                Mate in
                {' '}
                {
                  move.mate
                }
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            disabled={
              currentMoveIndex ===
              0
            }
            onClick={() =>
              setCurrentMoveIndex(
                currentMoveIndex -
                  1
              )
            }
          >
            ⬅ Prev
          </button>

          <button
            disabled={
              currentMoveIndex ===
              uploadedGame
                .moveHistory
                .length -
                1
            }
            onClick={() =>
              setCurrentMoveIndex(
                currentMoveIndex +
                  1
              )
            }
          >
            Next ➜
          </button>
        </div>
      </div>

      {/* RIGHT */}

      <div>
        <div
          style={{
            background:
              '#1c1c1c',
            padding: 20,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <h2>
            Accuracy
          </h2>

          <h1>
            {
              analysis.accuracy
            }
            %
          </h1>

          <p>
            ACPL:
            {' '}
            {
              analysis.acpl
            }
          </p>
        </div>

        <div
          style={{
            background:
              '#1c1c1c',
            padding: 20,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <h2>
            Coach
          </h2>

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
              >
                {
                  value.emoji
                }
                {' '}
                {
                  value.name
                }
              </button>
            )
          )}

          <div
            style={{
              marginTop: 20,
            }}
          >
            {coach.getComment(
              analysis
            )}
          </div>
        </div>

        <div
          style={{
            background:
              '#1c1c1c',
            padding: 20,
            borderRadius: 10,
          }}
        >
          <h2>
            💎 Brilliant
            Moves
          </h2>

          {analysis.brilliantMoves.map(
            (
              move,
              index
            ) => (
              <div
                key={index}
              >
                💎 Move
                {' '}
                {
                  move.turn
                }
                :
                {' '}
                {
                  move.move
                }
              </div>
            )
          )}

          <h2
            style={{
              marginTop: 20,
            }}
          >
            💥 Blunders
          </h2>

          {analysis.blunders.map(
            (
              move,
              index
            ) => (
              <div
                key={index}
                onClick={() =>
                  setCurrentMoveIndex(
                    move.turn -
                      1
                  )
                }
                style={{
                  cursor:
                    'pointer',
                }}
              >
                💥 Move
                {' '}
                {
                  move.turn
                }
                :
                {' '}
                {
                  move.move
                }
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
