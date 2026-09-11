# The shelf

Work that was built, measured and then **not** taken — kept here with the
numbers beside it so it can be picked up again when the thing that blocked it
changes, rather than rediscovered from scratch.

Nothing here is applied. Nothing here is dead either.

---

## `nebula-four-layers.patch`

**What it does.** Restores the nebula to the look it had before the speed
pass, and makes it move every frame: four cloud layers, each on its own
canvas, each keeping its own heading, its own speed and its own slow turn,
screened together with `mix-blend-mode: screen` over the sky, at **full**
resolution, slid and turned on the compositor with `translate3d` and
`rotate`, and repainted only on a resize, a distance change, or when a layer
has run out of the material it was laid with.

It is complete and it builds. `git apply docs/shelf/nebula-four-layers.patch`
puts it in.

**Why it is on the shelf.** It cannot hold 60fps on a machine with no GPU.

**What was measured**, 1440×900, production build, at the screen's own rate
(no `--disable-gpu-vsync`), on a container that rasterises in **software**
(ANGLE/SwiftShader — confirmed through `WEBGL_debug_renderer_info`):

| | board | timeline |
|---|---|---|
| the original: cloud canvas repainted 2.4×/s, layer never moves | **60fps, 0 late** | 60fps, 0 late |
| this patch: four layers, own headings and turns, full resolution | **13.9fps** | 11.5fps |
| the same at the original's own half resolution | 13.3fps | 10.1fps |
| the same with the slow turn frozen | 20.7fps | 17.6fps |
| four layers screened into one canvas per frame, not by the compositor | 24.1fps | 19.3fps |
| what is shipped: one field, one heading, half resolution | **60fps, 0 late** | 59.8fps, 1 late |

And the decomposition, same box, same window:

| | fps |
|---|---|
| no clouds at all | 59.2 |
| one layer, full resolution, screened | 30.9 |
| one layer, full resolution, no blend | 31.1 |
| four layers, full resolution, screened | 13.9 |
| four layers, full resolution, no blend | 13.5 |

**What those numbers say.** The cost is the number of window-sized layers the
compositor samples every frame. Blending is *free* at full resolution (13.9
against 13.5 unblended) and expensive only at half, where the layers are
small enough that the blend is the dominant term. Per-frame rotation costs
about a third on top. And the original only ever held 60 because the nebula
itself moved 2.4 times a second — its layer's transform never changed on any
frame, 0 of 241.

**What would change the answer.** A GPU. Compositing four window-sized
textures a frame is what graphics hardware does without noticing; every
number above is a **floor for software rasterisation, not a verdict on the
design**. Measure again on a machine with a graphics card before concluding
anything about this patch.

**How to measure it again.** Build for production (`npm run build` then
`npx next start`), then drive a real browser at the screen's own rate and
count frames whose gap exceeds 1.5× the median. The two numbers that matter
are the *beat* — it halves to 33ms when the ground is unaffordable — and how
many frames the cloud layer's transform actually changed on.
