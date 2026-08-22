/* toyShell.js — the shell every free-play toy runs inside.

   Deliberately much thinner than engine.js: there is no round loop, no star
   track, no win()/nudge()/celebration, because Pok-Pok-style free play has no
   objective at all — a toy is opened, tinkered with, and left whenever the
   child is done. The only two jobs here are chrome (a back button + title,
   reusing ui.js's topbar with its star track omitted by passing starCount 0)
   and teardown, so a toy module can focus entirely on its own interaction.

   Mirrors the teardown()/exit() split in engine.js from the start: destroy()
   only tears a toy down, exit() tears down AND navigates. Conflating the two
   caused a real infinite-recursion bug in engine.js (main.js tears a game
   down on its way into the very renderer that exit() would call) — worth
   avoiding here by construction rather than discovering it again.
*/

import { el } from './util.js';
import { topbar } from './ui.js';
import { stopSpeech } from './audio.js';

export function startToy({ toy, age, mount, onExit }) {
  let alive = true;
  let cleanups = [];

  const bar = topbar({ title: toy.title, onBack: () => exit() });
  const stage = el('div', { class: 'stage toy-stage' });
  mount.replaceChildren(bar.node, stage);

  function teardown() {
    if (!alive) return;
    alive = false;
    cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    cleanups = [];
    stopSpeech();
  }

  function exit() {
    if (!alive) return;      // idempotent, same as engine.js's exit()
    teardown();
    onExit();
  }

  const ctx = {
    age,
    stage,
    onCleanup(fn) { cleanups.push(fn); },
  };

  toy.mount(ctx);
  return { destroy: teardown };
}
