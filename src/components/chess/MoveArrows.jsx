import React from 'react';

const FILES = ['a','b','c','d','e','f','g','h'];

export default function MoveArrows({ arrows = [], flipped = false }) {

  const sqToXY = (sq) => {
    const file = FILES.indexOf(sq[0]);
    const rank = parseInt(sq[1]) - 1;

    return flipped
      ? { x: 7 - file, y: rank }
      : { x: file, y: 7 - rank };
  };

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-30"
      viewBox="0 0 8 8"
    >
      {arrows.map((a, i) => {
        const from = sqToXY(a.from);
        const to = sqToXY(a.to);

        return (
          <line
            key={i}
            x1={from.x + 0.5}
            y1={from.y + 0.5}
            x2={to.x + 0.5}
            y2={to.y + 0.5}
            stroke={a.color || 'rgba(0,150,255,0.6)'}
            strokeWidth="0.18"
            markerEnd="url(#arrowhead)"
          />
        );
      })}

      <defs>
        <marker
          id="arrowhead"
          markerWidth="0.3"
          markerHeight="0.3"
          refX="0.1"
          refY="0.15"
          orient="auto"
        >
          <polygon points="0 0, 0.3 0.15, 0 0.3" fill="rgba(0,150,255,0.8)" />
        </marker>
      </defs>
    </svg>
  );
}
