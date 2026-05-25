/**
 * StockfishEngine.js - Wrapper for Stockfish analysis
 * 
 * Usage:
 *   const engine = new StockfishEngine();
 *   await engine.init();
 *   const analysis = await engine.analyzeMove(fen, move, depth);
 */

class StockfishEngine {
  constructor() {
    this.stockfish = null;
    this.isReady = false;
    this.currentDepth = 20; // Default analysis depth
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        // Import Stockfish.js from node_modules or CDN
        const Stockfish = require('stockfish');
        this.stockfish = Stockfish();

        // Wait for engine to be ready
        this.stockfish.onmessage = (msg) => {
          if (msg.includes('uciok')) {
            this.isReady = true;
            resolve();
          }
        };

        // Initialize UCI protocol
        this.send('uci');
        this.send('isready');

        // Timeout if engine doesn't respond
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 5000);
      } catch (err) {
        reject(err);
      }
    });
  }

  send(command) {
    if (this.stockfish) {
      this.stockfish.postMessage(command);
    }
  }

  async analyzePosition(fen, depth = 20) {
    /**
     * Analyze a position and return evaluation
     * 
     * Returns: {
     *   eval: number,        // +0.79 or -0.89
     *   depth: number,       // 20
     *   bestMove: string,    // e.g., "e2e4"
     *   line: string[]       // Best continuation
     * }
     */
    return new Promise((resolve) => {
      let result = { eval: 0, depth, bestMove: '', line: [] };

      const messageHandler = (msg) => {
        // Parse UCI engine output
        if (msg.includes('bestmove')) {
          this.stockfish.onmessage = null;
          resolve(result);
        }

        // Extract evaluation
        if (msg.includes('score cp')) {
          const match = msg.match(/score cp (-?\d+)/);
          if (match) {
            result.eval = parseInt(match[1]) / 100; // Convert centipawns to pawns
          }
        }

        // Extract best move
        if (msg.includes('pv ')) {
          const match = msg.match(/pv ([\w\s]+)/);
          if (match) {
            result.line = match[1].trim().split(' ');
            result.bestMove = result.line[0];
          }
        }
      };

      this.stockfish.onmessage = messageHandler;

      // Send analysis command
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  async analyzeMove(fen, move, depth = 20) {
    /**
     * Analyze a specific move in a position
     * 
     * Parameters:
     *   fen: string (chess position)
     *   move: string (e.g., "e2e4")
     *   depth: number (analysis depth)
     * 
     * Returns: {
     *   moveEval: number,     // Evaluation after this move
     *   bestEval: number,     // Evaluation of best move
     *   bestMove: string,     // What should have been played
     *   classification: string, // Best, Good, Decent, Inaccuracy, Mistake, Blunder, Brilliant
     *   explanation: string
     * }
     */

    // Analyze position BEFORE move
    const beforeAnalysis = await this.analyzePosition(fen, depth);
    const beforeEval = beforeAnalysis.eval;
    const beforeBestMove = beforeAnalysis.bestMove;

    // Make the move and analyze AFTER
    const chess = new (require('chess.js').Chess)(fen);
    chess.move(move);
    const afterAnalysis = await this.analyzePosition(chess.fen(), depth);
    const afterEval = afterAnalysis.eval;

    // Determine move classification
    const evalDiff = Math.abs(beforeEval - afterEval);
    let classification = 'Decent';

    // Adjust evaluation for player's perspective
    const playerColor = chess.turn() === 'w' ? 'b' : 'w'; // Who just moved
    const isPlayerWhite = playerColor === 'w';
    const adjustedBefore = isPlayerWhite ? beforeEval : -beforeEval;
    const adjustedAfter = isPlayerWhite ? afterEval : -afterEval;
    const changeInEval = adjustedAfter - adjustedBefore;

    if (move === beforeBestMove) {
      classification = 'Best';
    } else if (changeInEval >= -0.15) {
      classification = 'Good';
    } else if (changeInEval >= -0.50) {
      classification = 'Decent';
    } else if (changeInEval >= -1.00) {
      classification = 'Inaccuracy';
    } else if (changeInEval >= -2.00) {
      classification = 'Mistake';
    } else if (changeInEval >= -5.00) {
      classification = 'Blunder';
    } else {
      classification = 'Blunder';
    }

    // Detect sacrifices/brilliant moves
    if (chess.get(move.substring(2, 4))) { // If move captures
      if (changeInEval >= 0.50) {
        classification = 'Brilliant'; // Sacrifice that wins
      }
    }

    return {
      moveEval: afterEval,
      bestEval: beforeEval,
      bestMove: beforeBestMove,
      classification,
      evalDiff: changeInEval,
      depth
    };
  }

  terminate() {
    if (this.stockfish) {
      this.stockfish.terminate();
      this.stockfish = null;
    }
  }
}

module.exports = StockfishEngine;
