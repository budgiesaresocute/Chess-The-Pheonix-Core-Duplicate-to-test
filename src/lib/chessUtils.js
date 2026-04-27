export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PIECE_CHARS = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

export function getPieceChar(piece) {
  if (!piece) return '';
  return PIECE_CHARS[piece.color + piece.type] || '';
}

export function isLightSquare(fileIdx, rankIdx) {
  return (fileIdx + rankIdx) % 2 === 0;
}
