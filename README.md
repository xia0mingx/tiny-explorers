# Tiny Explorers

A tablet-first learning app for **2-5 year olds**: seven quiz-style games with
a difficulty level for each age, plus a Free Play section of five open-ended
toys with no score and no correct answer. Built to be played on an iPad, held
sideways, by a child who cannot read yet — but every screen also fits a phone,
portrait or landscape, since a parent handing over their phone for five
minutes is just as common as a dedicated iPad.

Zero dependencies, zero build step, works offline. Open it in a browser and it
runs — the whole app is HTML, CSS and ES modules, and every piece of artwork is
SVG generated in code.

## Quick start (local development)

```bash
python -m http.server 8080 --directory toddler_game
```

Then open `http://localhost:8080`. A server is required (ES modules don't load
over `file://`). `localhost` counts as a *secure context*, so the service
worker registers here too — offline behaviour is fully testable without
deploying anywhere (see "Getting it on the iPad for real" below for why this
matters).

## Getting it on the iPad for real

**Loading the app from your laptop's dev server over the LAN (e.g.
`http://192.168.1.23:8080`) cannot give you a real offline install.** This
isn't a bug to fix — service workers only register in a *secure context*
(`https:`, or `localhost`/`127.0.0.1`), and a plain `http://` LAN address is
neither. The app will play fine while your laptop is running and serving it,
and will stop working the moment it isn't.

For an iPad that plays with the laptop off, in the car, on a plane — deploy
`toddler_game/` as-is to any free static HTTPS host:

- [GitHub Pages](https://pages.github.com/), [Netlify](https://www.netlify.com/) (drag-and-drop the folder), or [Cloudflare Pages](https://pages.cloudflare.com/)
- No build step, no config. Every path in the app is relative, so it works
  unchanged from a subpath like `you.github.io/repo/`.

Then, **once**, on the iPad:

1. Open the deployed URL in Safari, over Wi-Fi.
2. **Share → Add to Home Screen.**
3. Open the app from its home-screen icon (not from Safari — see below for why
   that matters).
4. Hold the gear in the top corner and confirm it says **"Ready to play
   offline — N of N files saved."**
5. Turn on Airplane Mode and confirm it still plays.

After that one-time setup, no network is needed ever again — until you deploy
a change, at which point the app quietly re-caches the new version in the
background the next time it's opened online (see "The service worker" below).

**Home-screen apps get their own storage**, separate from Safari's — progress
earned while testing in the Safari tab won't show up in the installed app, and
Safari's own storage can be cleared by iOS after a week of disuse in a way the
home-screen app's storage is not. Installing to the home screen is what makes
star progress actually durable.

## The games

| Game | Skill | Age 2 | Age 3 | Age 4 | Age 5 |
|---|---|---|---|---|---|
| **Counting** | number sense | count 1-3, 2 choices | 1-5, 3 choices | 1-10, 4 choices | **addition to 10** |
| **Shapes** | form recognition | 3 shapes | 5 shapes | 8 shapes, **rotated** | 11 shapes, look-alike distractors |
| **Shadows** | visual matching | 2 shadows | 3 shadows | 4, with look-alikes | 4, plus **mirrored** decoys |
| **Patterns** | sequencing | AB, gap at end | AB / AAB | ABC / ABB | AABB, **gap in the middle** |
| **Tracing** | pre-writing | lines, arcs | zigzag, wave, circle | circle, square, triangle | **numbers and letters** |
| **Mazes** | planning | 3x3 | 4x4 | 5x5 | 6x6 |
| **Spot It** | attention to detail | 1 difference | 2 | 3 | 4, incl. mirrored |

Each session is a handful of rounds (3-6 depending on the game) and ends in a
celebration, which keeps a sitting to roughly two to four minutes — about the
attention span being designed for.

## Free Play

Five open-ended toys, modelled on the Montessori-style "no objective, just
tinker" toys in apps like Pok Pok, rather than the quiz format above. Opening
one never shows a prompt or a star track — there's nothing to get right or
wrong, so a session ends whenever the child taps back, not when a round is won.

| Toy | What it is |
|---|---|
| **Drawing** | Finger-paint (Brush mode) or tap to place a coloured sprite (Stamp mode), on a blank canvas. Clear is instant — nothing here is precious. |
| **Dress-Up** | Pick a friend, a colour, and an accessory for a simple character; a shuffle button randomises all three at once. |
| **Music Maker** | An 8-step, 5-row sequencer tuned to a pentatonic scale, so every combination a child taps sounds pleasant — there's no wrong note. |
| **Dot to Dot** | Numbered dots trace out a shape — circles and stars through to a car, Mickey-style ears, or a fish — connecting them in order fills it in with colour, then a new shape starts automatically. |
| **Drive** | Drag a car or a little toy train around a birds-eye town map of streets and blocks; the vehicle eases toward your finger and the train's carriages trail the engine at a fixed distance along its own path. A Honk button and a colour picker are the only other controls. |

## Design rules

These are the constraints the whole app is built around. They're worth knowing
before changing anything, because most of the code follows from them.

**There is no fail state.** Nothing is timed, nothing can be lost, no score goes
down, and no wrong answer is removed or greyed out. A wrong tap wobbles, plays a
soft two-note "hmm" (deliberately not a buzzer), and the child tries again.
Every session ends in confetti. A 2-year-old who has just been told they were
wrong puts the tablet down.

**Nothing depends on reading.** Every instruction can be spoken aloud on demand
via the speaker button, and every answer is answerable from the picture alone
regardless of whether it's spoken — counting cards show dots next to the
numeral so quantity can be matched without knowing the symbol. Speech is silent
by default (see "Sound" below) and never required to solve a round.

**Touch targets are roughly double the adult minimum.** Apple's guideline floor
is 44pt; here nothing interactive is under 88px, because toddlers aim badly and
plant a whole fingertip rather than a point.

**The games can't be passed by the wrong strategy.** Shape options are always
different colours so form is the only usable cue. Tracing tracks ordered
waypoints, so scribbling over the whole shape does not complete it (verified —
scribbling and back-to-front drags both score 0%). Shadow rounds never contain
two identical silhouettes.

**Everything stays on the device.** localStorage only. No accounts, no network
calls, no analytics, no ads, no purchases, nothing that can be tapped through to
the outside world.

## How it fits together

```
index.html
  src/main.js             four screens: age picker -> home -> game/toy
  src/engine.js           quiz shell: round loop, star track, celebration
  src/toyShell.js         free-play shell: just chrome + teardown, no rounds
  src/games/*.js          one module per quiz game — renders a round, calls ctx.win()
  src/toys/*.js           one module per free-play toy (drawing, dress-up,
                          music, dot to dot, drive) — no win state at all
  src/art.js              every sprite, drawn in code
  src/audio.js            WebAudio effects + on-demand speech synthesis
  src/state.js            localStorage (age, stars, sound/speech settings)
  src/ui.js               top bar, confetti, celebration, parent gate + settings
  src/offline.js          service worker registration + "is it cached?" status
  src/cache-manifest.js   the file list sw.js caches, shared with src/offline.js
sw.js                     the service worker (stale-while-revalidate)
```

A quiz game module is small and only does one thing: render a round into
`ctx.stage` and call `ctx.win()` when it's solved. It never touches the star
track, round counting or the reward animation — `engine.js` owns all of that,
so the feedback loop is identical across all seven games.

A free-play toy is even smaller: it gets a `stage` and `onCleanup()` from
`toyShell.js` and nothing else — no prompt, no star track, no win/nudge, since
there's no objective to signal. See `src/toyShell.js`'s own comment for why it
mirrors `engine.js`'s teardown()/exit() split from the start rather than
re-discovering that bug.

### Artwork is code, and silhouettes are derived

`art.js` holds 42 sprites, each a function returning SVG inside a 100x100 box.
There are no image files, so nothing to export, optimise, or keep at 2x/3x for
retina.

The shadow-matching game does **not** have a second set of artwork:
`renderSprite({silhouette: true})` rewrites every fill and stroke to one flat
colour, collapsing the sprite into a solid blob. Two consequences for anyone
adding a sprite:

1. Build it from **opaque overlapping shapes** so it flattens cleanly.
2. Make it identifiable **by outline alone** — ears, beaks, trunks and tails are
   the whole point. Two round-headed animals differing only in face markings
   would produce an unsolvable shadow round.

### Sound

Effects are synthesised with WebAudio (a few shaped sine tones), not shipped as
files — nothing to download, and it keeps the app genuinely offline. They need
a real user gesture before iPadOS will let them make a sound, so the first
touch anywhere unlocks them. Sound effects can be turned off in settings.

**Speech is silent by default.** Nothing speaks on its own — the speaker
button next to each instruction (using `speechSynthesis` with a warm voice
where the OS has one) is the only thing that ever talks, so a session is quiet
unless a child specifically asks for it. A grown-up can flip "Read instructions
aloud" on in settings to have every prompt spoken automatically instead, for a
child too young to press the speaker on their own.

`chooseVoice()` in `audio.js` prefers any installed voice labelled
"Natural"/"Neural"/"Online" — the tier modern Windows/Edge and Android/Chrome
ship alongside their older, more robotic SAPI/eSpeak-era voices — before
falling back to a hardcoded list of known-good classic voices (Samantha,
Google UK/US English, etc.). Pitch is tuned to 1.08 rather than pushed
higher: most engines pitch-shift by simple resampling rather than preserving
formants, so the further it sits from 1.0 the more "chipmunk" it sounds.

### Settings are behind a hold, not a tap

The gear in the top-right needs a **1.2 second press**. That is the entire
parent gate: trivial for an adult who's been told, and reliably beyond a toddler
who taps everything. It guards the sound toggles and the progress reset — not
anything dangerous, since there's nothing dangerous in the app.

## Regenerating the icons

```bash
python tools/make_icons.py
```

Writes `icons/` from scratch using only the standard library (`zlib` + `struct`,
no Pillow). PNGs are needed because iPadOS's "Add to Home Screen" reads
`apple-touch-icon`, which doesn't accept SVG.

## Notes for later

- **Adding a quiz game**: drop a module in `src/games/`, export the same shape
  as the others (`id`, `title`, `color`, `rounds(age)`, `icon()`, `round(ctx)`),
  and add it to `src/games/index.js`.
- **Adding a free-play toy**: drop a module in `src/toys/`, export `id`,
  `title`, `color`, `icon()` and `mount(ctx)` (no `rounds`/`round` — a toy
  never ends), and add it to `src/toys/index.js`.
- **Either way**, also add the new file(s) to the `SHELL` list in
  `src/cache-manifest.js` (shared by `sw.js` and the offline-ready indicator —
  missing it there means the new game/toy silently isn't available offline,
  and the indicator won't catch it since it only counts what's *in* the list,
  not what's missing from it).
- **Tracing is single-stroke only.** Multi-stroke glyphs like `A` or `t` need a
  pen lift, which the drag model has no way to express. Adding them means
  teaching the game about stroke sequences first.
- **The service worker is stale-while-revalidate**: it serves from cache
  instantly (the point of working offline) and refreshes each entry in the
  background. A deployed update therefore lands on the *second* launch after it
  ships, not the first — the right trade for an app whose main job is working
  with zero network. Bump `CACHE_NAME` in `src/cache-manifest.js` if you ever
  need to force a clean re-cache.
- Speech voice quality varies a lot by platform — iPadOS is good, Windows
  Chrome is robotic. Judge the audio on the actual target device.
- **`.overlay` (the celebration screen and the settings sheet) centers via
  auto margins on its first/last child, not `justify-content: center`.**
  Content taller than the viewport is common on a phone in landscape (confirmed
  at 812×375, the settings sheet is ~578px tall) — `justify-content: center`
  clips the overflow off the top with no way to scroll to it, while auto
  margins collapse to 0 once content doesn't fit and fall back to normal
  top-down scrolling. Don't "simplify" this back to `justify-content: center`.
- No test suite. Verification so far has been done by driving the real app in a
  browser; if this grows, the pure logic worth testing first is maze generation,
  pattern sequencing, and the tracing waypoint advance.
