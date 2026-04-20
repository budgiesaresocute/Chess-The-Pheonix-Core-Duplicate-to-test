import React, { useEffect, useRef } from 'react';

export default function MoveHistory({ history }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ move: i + 1, white: history[i], black: history[i + 1] });
  }

  return (
    <div className="h-full bg-card rounded-xl border border-border overflow-y-auto p-2">
      <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Move History</div>
      {pairs.length === 0 && (
        <div className="text-xs text-muted-foreground text-center mt-4">No moves yet</div>
      )}
      {pairs.map(({ move, white, black }) => (
        <div key={move} className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-secondary/50 text-xs">
          <span className="text-muted-foreground w-5">{move}.</span>
          <span className="flex-1 text-foreground font-mono">{white?.san}</span>
          <span className="flex-1 text-foreground font-mono">{black?.san || ''}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
      }
