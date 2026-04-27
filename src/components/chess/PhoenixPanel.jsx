import React from 'react';
import { PIECE_DICE_VALUES } from '../../lib/phoenixCoreLogic';

const DICE_PIECE_MAP = {
  1: { piece: 'Pawn', icon: '♟' },
  2: { piece: 'Knight', icon: '♞' },
  3: { piece: 'Bishop', icon: '♝' },
  4: { piece: 'Rook', icon: '♜' },
  5: { piece: 'Queen', icon: '♛' },
  6: { piece: 'King', icon: '♚' },
};

export default function PhoenixPanel({
  currentTurn, phoenixState, diceValue,
  mustMovePhoenix, phoenixSelected,
  onSelectPhoenix, onRollDice, turnCount
}) {
  const active = phoenixState.active[currentTurn];
  const used = phoenixState.used[currentTurn];
  const pos = phoenixState.positions[currentTurn];
  const turnsSince = phoenixState.turnsSinceMoved[currentTurn] || 0;

  return (
    <div className="bg-card rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">🔥 Phoenix Core</span>
        <span className="text-xs text-muted-foreground">
          {currentTurn === 'w' ? '🔵 White' : '🔴 Black'}
        </span>
      </div>

      {!active && (
        <div className="text-xs text-muted-foreground text-center py-1">
          {used ? 'Phoenix used ✓' : 'Phoenix gone'}
        </div>
      )}

      {active && (
        <>
          <div className="text-xs text-muted-foreground">
            Position: <span className="text-foreground font-mono font-bold">{pos?.toUpperCase() || '?'}</span>
            {mustMovePhoenix && <span className="text-red-400 ml-2">Must move!</span>}
            {!mustMovePhoenix && <span className="ml-2">({3 - turnsSince} turns left)</span>}
          </div>

          {!diceValue ? (
            <button
              onClick={onRollDice}
              className="w-full py-2 text-xs rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
            >
              🎲 Roll Dice
            </button>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-center">
                Rolled: <span className="font-bold text-primary">{diceValue}</span>
                {' → '}{DICE_PIECE_MAP[diceValue]?.icon} {DICE_PIECE_MAP[diceValue]?.piece} moves
              </div>
              <button
                onClick={onSelectPhoenix}
                className={`w-full py-2 text-xs rounded-lg font-bold transition-colors ${
                  phoenixSelected
                    ? 'bg-orange-500 text-white'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {phoenixSelected ? '🔥 Moving Phoenix...' : '🔥 Move Phoenix'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
          }
