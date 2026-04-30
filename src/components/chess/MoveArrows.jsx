import React from 'react';

const FILES = ['a','b','c','d','e','f','g','h'];

export default function MoveArrows({ arrows = [], flipped = false }) {
  const center = (sq) => {
    const file = FILES.indexOf(sq[0]);
    const rank = parseInt(sq[1]) - 1;
    const x = flipped ? (7 - file) : file;
    const y = flipped ? rank : (7 - rank);
    return { x: x + 0.5, y: y + 0.5 };
  };

  if (!arrows.length) return null;

  return (
    <svg
      style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:30 }}
      viewBox="0 0 8 8"
    >
      <defs>
        <marker id="mah-orange" markerWidth="0.6" markerHeight="0.6" refX="0.45" refY="0.3" orient="auto">
          <polygon points="0 0,0.6 0.3,0 0.6" fill="rgba(255,140,0,0.95)" />
        </marker>
        <marker id="mah-blue" markerWidth="0.6" markerHeight="0.6" refX="0.45" refY="0.3" orient="auto">
          <polygon points="0 0,0.6 0.3,0 0.6" fill="rgba(0,150,255,0.95)" />
        </marker>
        <marker id="mah-green" markerWidth="0.6" markerHeight="0.6" refX="0.45" refY="0.3" orient="auto">
          <polygon points="0 0,0.6 0.3,0 0.6" fill="rgba(0,200,80,0.95)" />
        </marker>
      </defs>
      {arrows.map((a, i) => {
        if (a.from === a.to) return null;
        const f = center(a.from), t = center(a.to);
        const dx = t.x - f.x, dy = t.y - f.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len === 0) return null;
        // Shorten end so arrowhead doesn't overlap
        const ex = t.x - (dx/len)*0.35, ey = t.y - (dy/len)*0.35;
        const color = a.color || 'orange';
        const strokeMap = {
          orange: 'rgba(255,140,0,0.8)',
          blue: 'rgba(0,150,255,0.8)',
          green: 'rgba(0,200,80,0.8)'
        };
        return (
          <line key={i}
            x1={f.x} y1={f.y} x2={ex} y2={ey}
            stroke={strokeMap[color] || strokeMap.orange}
            strokeWidth="0.2" strokeLinecap="round"
            markerEnd={`url(#mah-${color})`}
          />
        );
      })}
    </svg>
  );
    }
