import React, { useState, useRef } from 'react';
import MoveArrows from './MoveArrows';

const PIECE_IMAGES = {
  wk: 'https://www.chess.com/chess-themes/pieces/neo/150/wk.png',
  wq: 'https://www.chess.com/chess-themes/pieces/neo/150/wq.png',
  wr: 'https://www.chess.com/chess-themes/pieces/neo/150/wr.png',
  wb: 'https://www.chess.com/chess-themes/pieces/neo/150/wb.png',
  wn: 'https://www.chess.com/chess-themes/pieces/neo/150/wn.png',
  wp: 'https://www.chess.com/chess-themes/pieces/neo/150/wp.png',
  bk: 'https://www.chess.com/chess-themes/pieces/neo/150/bk.png',
  bq: 'https://www.chess.com/chess-themes/pieces/neo/150/bq.png',
  br: 'https://www.chess.com/chess-themes/pieces/neo/150/br.png',
  bb: 'https://www.chess.com/chess-themes/pieces/neo/150/bb.png',
  bn: 'https://www.chess.com/chess-themes/pieces/neo/150/bn.png',
  bp: 'https://www.chess.com/chess-themes/pieces/neo/150/bp.png',
};

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = [8,7,6,5,4,3,2,1];
const SQ = 44;

export default function ChessBoard({
  game, selectedSquare, legalMoves = [], lastMove,
  onSquareClick, checkSquare,
  phoenixSquares, phoenixMoves = [], phoenixSelected, activePhoenixColor,
  flipped = false,
}) {
  const board = game.board();
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : RANKS;
  const files = flipped ? ['h','g','f','e','d','c','b','a'] : FILES;

  const [arrows, setArrows] = useState([]);
  const [highlights, setHighlights] = useState([]);

  // Desktop right-click arrows
  const rcFrom = useRef(null);

  const handleMouseDown = (sq, e) => {
    if (e.button === 2) { rcFrom.current = sq; e.preventDefault(); }
  };

  const handleMouseUp = (sq, e) => {
    if (e.button === 2) {
      const from = rcFrom.current;
      rcFrom.current = null;
      if (!from) return;
      if (from === sq) {
        setHighlights(prev =>
          prev.includes(sq) ? prev.filter(s => s !== sq) : [...prev, sq]
        );
      } else {
        setArrows(prev => {
          const idx = prev.findIndex(a => a.from === from && a.to === sq);
          return idx >= 0
            ? prev.filter((_, i) => i !== idx)
            : [...prev, { from, to: sq, color: 'orange' }];
        });
      }
      e.preventDefault();
    }
  };

  const handleContextMenu = (e) => e.preventDefault();

  // Mobile long press and drag arrows
  const pressTimer = useRef(null);
  const touchFrom = useRef(null);
  const touchMoved = useRef(false);
  const longPressed = useRef(false);

  const getSquareFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.dataset?.square || null;
  };

  const handleTouchStart = (sq, e) => {
    touchFrom.current = sq;
    touchMoved.current = false;
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setHighlights(prev =>
        prev.includes(sq) ? prev.filter(s => s !== sq) : [...prev, sq]
      );
    }, 420);
  };

  const handleTouchMove = () => {
    touchMoved.current = true;
    clearTimeout(pressTimer.current);
  };

  const handleTouchEnd = (sq, e) => {
    clearTimeout(pressTimer.current);
    if (longPressed.current) return;
    const touch = e.changedTouches[0];
    const toSq = getSquareFromPoint(touch.clientX, touch.clientY) || sq;
    if (touchMoved.current && touchFrom.current && touchFrom.current !== toSq) {
      const from = touchFrom.current;
      setArrows(prev => {
        const idx = prev.findIndex(a => a.from === from && a.to === toSq);
        return idx >= 0
          ? prev.filter((_, i) => i !== idx)
          : [...prev, { from, to: toSq, color: 'orange' }];
      });
    }
    touchFrom.current = null;
  };

  const handleClick = (sq) => {
    // Clear arrows and highlights on normal move click
    if (arrows.length > 0 || highlights.length > 0) {
      setArrows([]);
      setHighlights([]);
    }
    onSquareClick(sq);
  };

  return (
    <div
      className="relative inline-block select-none"
      onContextMenu={handleContextMenu}
    >
      <div className="flex">
        {/* Rank labels */}
        <div className="flex flex-col" style={{ width: 18 }}>
          {ranks.map(rank => (
            <div key={rank} style={{
              color: '#b58863', width: 18, height: SQ,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 'bold', opacity: 0.8
            }}>
              {rank}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          {/* Arrow/highlight overlay */}
          <MoveArrows arrows={arrows} highlights={highlights} flipped={flipped} />

          {/* Highlight layer (yellow squares) */}
          {highlights.length > 0 && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: SQ*8, height: SQ*8, pointerEvents: 'none', zIndex: 40 }}>
              {highlights.map((sq, i) => {
                const file = FILES.indexOf(sq[0]);
                const rank = parseInt(sq[1]) - 1;
                const x = flipped ? (7 - file) : file;
                const y = flipped ? rank : (7 - rank);
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left: x * SQ, top: y * SQ,
                    width: SQ, height: SQ,
                    backgroundColor: 'rgba(255,200,0,0.45)',
                    pointerEvents: 'none',
                  }} />
                );
              })}
            </div>
          )}

          {ranks.map((rank, ri) => (
            <div key={rank} className="flex">
              {files.map((file, fi) => {
                const square = file + rank;
                const boardRi = 8 - rank;
                const boardFi = FILES.indexOf(file);
                const piece = board[boardRi][boardFi];

                const isLight = (boardRi + boardFi) % 2 === 0;
                const isSelected = selectedSquare === square;
                const isLegal = legalMoves.includes(square);
                const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
                const isCheck = checkSquare === square;
                const isPhoenixMove = phoenixMoves.includes(square);
                const hasWhitePhoenix = phoenixSquares?.w === square;
                const hasBlackPhoenix = phoenixSquares?.b === square;

                let bgColor = isLight ? '#f0d9b5' : '#b58863';
                if (isLastMove) bgColor = isLight ? '#cdd16f' : '#aaa23a';
                if (isSelected) bgColor = '#f6f669';
                if (isCheck) bgColor = '#ff6b6b';

                return (
                  <div
                    key={square}
                    data-square={square}
                    onClick={() => handleClick(square)}
                    onMouseDown={(e) => handleMouseDown(square, e)}
                    onMouseUp={(e) => handleMouseUp(square, e)}
                    onTouchStart={(e) => handleTouchStart(square, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={(e) => handleTouchEnd(square, e)}
                    style={{
                      width: SQ, height: SQ,
                      backgroundColor: bgColor,
                      position: 'relative',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {isLegal && !piece && (
                      <div style={{
                        position: 'absolute', width: 14, height: 14,
                        borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 10
                      }} />
                    )}
                    {isLegal && piece && (
                      <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(0,0,0,0.3)', zIndex: 10 }} />
                    )}
                    {isPhoenixMove && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: 'rgba(255,165,0,0.35)',
                        border: '3px solid orange', zIndex: 10
                      }} />
                    )}
                    {piece && (
                      <div style={{ position: 'relative', zIndex: 20 }}>
                        {((hasWhitePhoenix && piece.color === 'w') || (hasBlackPhoenix && piece.color === 'b')) && (
                          <div style={{
                            position: 'absolute', inset: -6, borderRadius: '50%',
                            border: piece.color === 'w' ? '3px solid rgba(100,180,255,0.9)' : '3px solid rgba(255,80,80,0.9)',
                            boxShadow: piece.color === 'w' ? '0 0 10px 4px rgba(100,180,255,0.6)' : '0 0 10px 4px rgba(255,80,80,0.6)',
                            zIndex: 25
                          }} />
                        )}
                        <img
                          src={PIECE_IMAGES[piece.color + piece.type]}
                          alt={piece.color + piece.type}
                          style={{ width: 38, height: 38, userSelect: 'none', pointerEvents: 'none', display: 'block' }}
                        />
                      </div>
                    )}
                    {(hasWhitePhoenix || hasBlackPhoenix) && !piece && (
                      <div style={{
                        position: 'absolute', inset: 4, borderRadius: '50%',
                        border: hasWhitePhoenix ? '3px solid rgba(100,180,255,0.9)' : '3px solid rgba(255,80,80,0.9)',
                        boxShadow: hasWhitePhoenix ? '0 0 12px 5px rgba(100,180,255,0.5)' : '0 0 12px 5px rgba(255,80,80,0.5)',
                        zIndex: 15
                      }} />
                    )}
                    {fi === 0 && (
                      <span style={{
                        position: 'absolute', top: 1, left: 2, fontSize: 9,
                        fontWeight: 'bold', opacity: 0.7,
                        color: isLight ? '#b58863' : '#f0d9b5', zIndex: 5
                      }}>{rank}</span>
                    )}
                    {ri === ranks.length - 1 && (
                      <span style={{
                        position: 'absolute', bottom: 1, right: 2, fontSize: 9,
                        fontWeight: 'bold', opacity: 0.7,
                        color: isLight ? '#b58863' : '#f0d9b5', zIndex: 5
                      }}>{file}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* File labels */}
          <div className="flex" style={{ height: 18 }}>
            {files.map(file => (
              <div key={file} style={{
                width: SQ, height: 18, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 9, fontWeight: 'bold', opacity: 0.7, color: '#b58863'
              }}>
                {file}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
                  }
