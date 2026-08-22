/* The game roster, in the order they appear on the home screen — roughly
   easiest-to-hardest for a young child, and alternating tap-based games with
   drag-based ones so a session doesn't demand the same motor skill throughout. */

import counting from './counting.js';
import shapes from './shapes.js';
import patterns from './patterns.js';
import shadows from './shadows.js';
import tracing from './tracing.js';
import differences from './differences.js';
import maze from './maze.js';

export const GAMES = [counting, shapes, shadows, patterns, tracing, maze, differences];

export const gameById = (id) => GAMES.find((g) => g.id === id);
