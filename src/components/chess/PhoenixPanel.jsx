import React from 'react';

const DICE_PIECE_MAP = {
  1: { piece: 'Pawn',   icon: '♟' },
  2: { piece: 'Knight', icon: '♞' },
  3: { piece: 'Bishop', icon: '♝' },
  4: { piece: 'Rook',   icon: '♜' },
  5: { piece: 'Queen',  icon: '♛' },
  6: { piece: 'King',   icon: '♚' },
};

export default function PhoenixPanel({
  currentTurn, phoenixState, diceValue,
  hasRolledThisTurn, mustMovePhoenix, phoenixSelected,
  onSelectPhoenix, onRollDice, turnCount,
}) {
  const active = phoenixState.active[currentTurn];
  const used = phoenixState.used[currentTurn];
  const pos = phoenixState.positions[currentTurn];
  const turnsSince = phoenixState.turnsSinceMoved[currentTurn] || 0;
  const turnsLeft = 3 - turnsSince;

  // Can roll if: phoenix active, haven't rolled this turn, not in must-move state
  const canRoll = active && !hasRolledThisTurn && !diceValue;
  const mustRoll = active && mustMovePhoenix && !diceValue;

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
          {used ? '✓ Phoenix used — revival done' : 'Phoenix gone'}
        </div>
      )}

      {active && (
        <>
          <div className="text-xs text-muted-foreground">
            Position: <span className="text-foreground font-mono font-bold">{pos?.toUpperCase() || '?'}</span>
            {mustMovePhoenix
              ? <span className="text-red-400 ml-2 font-bold animate-pulse"> ⚠ Must move!</span>
              : <span className="ml-2 text-muted-foreground"> ({turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left)</span>
            }
          </div>

          {!diceValue ? (
            <button
              onClick={onRollDice}
              disabled={!canRoll && !mustRoll}
              className={`w-full py-2 text-xs rounded-lg font-bold transition-colors ${
                mustRoll
                  ? 'bg-red-500 text-white animate-pulse cursor-pointer'
                  : canRoll
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                    : 'bg-secondary text-muted-foreground opacity-40 cursor-not-allowed'
              }`}
            >
              {mustRoll
                ? '🎲 MUST Roll Dice!'
                : hasRolledThisTurn
                  ? '🎲 Already rolled this turn'
                  : '🎲 Roll Dice (optional)'}
            </button>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-center bg-secondary rounded-lg py-1">
                Rolled: <span className="font-bold text-primary">{diceValue}</span>
                {' → '}{DICE_PIECE_MAP[diceValue]?.icon} {DICE_PIECE_MAP[diceValue]?.piece} movement
              </div>
              <button
                onClick={onSelectPhoenix}
                className={`w-full py-2 text-xs rounded-lg font-bold transition-colors ${
                  phoenixSelected
                    ? 'bg-orange-500 text-white'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {phoenixSelected ? '🔥 Tap destination to move Phoenix' : '🔥 Move Phoenix'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
                }
