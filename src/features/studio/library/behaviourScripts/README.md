# library/behaviourScripts

The behaviour scripts (strings run on the exported site), split by topic. `../behaviours.ts` re-exports `BEHAVIOURS` and `AMBIENT`. Imports keep their `.ts` extension so tests can load these in Node.

| File | Holds |
| --- | --- |
| `motion.ts` | `CALM`, `SHEET_TRANSITION`, `REVEAL`, `COPY`, `TILT`, `FOLLOW`, `MARQUEE` |
| `effects.ts` | `EMBED`, `CRT`, `DUST`, `SCROLL_HEADER`, `BLINK`, `SPIN`, `FLOAT`, `HOVER_LIFT`, `SCROLL_GROW` |
| `interactions.ts` | `PRESS_SHOWS`, `GLIDE`, `WORLD_DIALOGS` |
| `list.ts` | `BEHAVIOURS` (every script by name) and `AMBIENT` |
