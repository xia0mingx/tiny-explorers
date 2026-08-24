/* The free-play toy roster — Pok-Pok-style open-ended toys with no rounds,
   no stars, no correct answer. See src/toyShell.js for the (much thinner)
   shell they run inside, and each toy module for why it looks the way it
   does. */

import drawing from './drawing.js';
import dressup from './dressup.js';
import music from './music.js';
import dotToDot from './dotToDot.js';
import drive from './drive.js';
import gears from './gears.js';

export const TOYS = [drawing, dressup, music, dotToDot, drive, gears];
