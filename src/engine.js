/* engine.js — the shell every game runs inside.

   A game module never touches the top bar, the star track, round counting or the
   celebration; it only renders one round into ctx.stage and calls ctx.win() when
   the child solves it. That keeps the seven games small and makes the reward
   behaviour identical everywhere, which matters more here than it would in an
   adult app: the feedback loop IS the product for this age group.

   The one rule the whole engine is built around: there is no fail state. A wrong
   tap wobbles and costs nothing, rounds cannot be lost, and every session ends in
   a celebration. Nothing is timed.
*/

import { el, wait } from './util.js';
import { glyph } from './art.js';
import { topbar, iconButton, celebrate } from './ui.js';
import { sfx, say, sayAuto, stopSpeech } from './audio.js';
import { addStars } from './state.js';

/**
 * Mount a game and run it to completion.
 * @param {object} o  game module, age, mount element, onExit callback
 */
export function startGame({ game, age, mount, onExit }) {
  const total = game.rounds ? game.rounds(age) : 6;
  let roundIndex = 0;
  let locked = false;      // ignore taps between "correct" and the next round
  let alive = true;        // false once the player leaves; stops queued timers
  let cleanups = [];
  let promptText = '';

  const bar = topbar({
    title: game.title,
    subtitle: `Age ${age}`,
    starCount: total,
    onBack: () => exit(),
  });

  const promptLabel = el('span');
  const promptBar = el('div', { class: 'prompt' },
    promptLabel,
    iconButton(glyph.speaker(), () => say(promptText), 'Say that again'));

  const stage = el('div', { class: 'stage' });

  mount.replaceChildren(bar.node, promptBar, stage);

  function runCleanups() {
    cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    cleanups = [];
  }

  /* Teardown and navigation are deliberately separate calls.
     The owner (main.js) tears a game down on its way to rendering another
     screen, so a destroy() that also navigated would call back into the
     renderer that is already running — which recursed until the stack blew.
     destroy() only stops the game; exit() is what leaves it. */
  function teardown() {
    if (!alive) return;
    alive = false;
    runCleanups();
    stopSpeech();
  }

  function exit() {
    if (!alive) return;      // idempotent: back button and celebration share it
    teardown();
    onExit();
  }

  const ctx = {
    age,
    total,
    get roundIndex() { return roundIndex; },
    stage,
    say,
    sfx,

    /** Set the instruction shown at the top. Read aloud automatically only if
     *  the parent has enabled it (off by default) — otherwise the speaker
     *  button is the only thing that ever speaks it. */
    prompt(text) {
      promptText = text;
      promptLabel.textContent = text;
      sayAuto(text);
    },

    /** Register teardown for anything that outlives the stage's own DOM
     *  (global listeners, animation frames, timers). */
    onCleanup(fn) { cleanups.push(fn); },

    /** Wrong answer: a wobble, a soft tone, and nothing else. No penalty, no
     *  removal of the option, no progress lost — the child simply tries again. */
    nudge(node) {
      if (locked) return;
      sfx('wrong');
      if (!node) return;
      node.classList.remove('wrong');
      void node.offsetWidth;     // restart the CSS animation
      node.classList.add('wrong');
      setTimeout(() => node.classList.remove('wrong'), 480);
    },

    /** Partial progress inside a multi-step round (a maze corner, one of four
     *  differences found). Rewards without advancing the round. */
    ping() { sfx('sparkle'); },

    /** The round is solved. Awards the star and moves on. */
    async win(node) {
      if (locked || !alive) return;
      locked = true;
      if (node) node.classList.add('correct');
      sfx('correct');
      bar.fillStar(roundIndex);

      await wait(1150);
      if (!alive) return;

      roundIndex += 1;
      if (roundIndex >= total) finish();
      else nextRound();
    },
  };

  function nextRound() {
    runCleanups();
    locked = false;
    stage.replaceChildren();
    game.round(ctx);
  }

  function finish() {
    addStars(game.id, age, total);
    celebrate({
      starsWon: total,
      onAgain: () => {
        if (!alive) return;
        roundIndex = 0;
        for (let i = 0; i < total; i += 1) bar.node.querySelectorAll('.star-slot')[i]
          .innerHTML = glyph.starEmpty();
        nextRound();
      },
      onHome: exit,
    });
  }

  nextRound();
  return { destroy: teardown };
}
