# Motion assets: keyframes in, smooth motion out

This is the brief the Builder will emit for every motion asset once Stage 6
lands, and the shape of the tool that makes one. It is written now so the
generator, and any agent reading a blueprint, already knows what "interpolate
these frames" is supposed to produce.

## The numbers

| Setting | Default | Why |
|---|---|---|
| Keyframes | 5 | Enough checkpoints to steer the motion without drawing it all |
| Duration | 1.5 s | Long enough to read as movement, short enough to loop |
| Frame rate | 30 fps (45 frames) | Smooth on the web at half the size of 60 |
| Optional | 60 fps (90 frames) | For hero-scale or cursor-level motion |
| Hold per keyframe | 2 frames | So each checkpoint registers before it moves on |
| Loop `once` / `ping-pong` | 4 gaps of ~0.375 s (~11 frames at 30 fps) | Last frame is the last keyframe |
| Loop `wrap` | 5 gaps of 0.3 s (9 frames) | The fifth gap returns to keyframe 1, seamless |

## The crate

A panel that looks like a record crate seen from above.

1. **Sleeves.** Each sleeve is one of your frames. Drop images in, pull one out
   to see it large, drag sleeves to reorder. Five is typical; any number works.
2. **Gaps.** Between every two sleeves: how many in-between frames, the easing
   curve, how long the checkpoint holds. That is the whole tweening setting.
3. **Generate.** Each pair of neighbours goes to an interpolation model. Small
   jumps use a frame-interpolation model (fast, cheap). Large jumps between
   very different frames use an image-to-video model given the start and end
   frame, which invents the motion.
4. **Scrub.** The result plays in the crate. Drag across the sleeves to scrub.
   Keep it, regenerate one gap, or change a frame and go again.
5. **Use it.** The sequence saves as a motion asset any element can wear: a
   background layer, a hero visual, a button's hover state, a cursor trail. It
   flows into the blueprint like any other skin.

**Train on my art.** A reference drawer next to the crate. Upload similar art
(sketches, stills, textures) and it becomes a style set. Two levels:

- *Default:* every generation is conditioned on the references. No training.
- *Advanced:* a small style adapter is trained on the set (about fifteen
  minutes on Replicate, a few dollars), then every gap is generated in that
  style.

The provider sits behind one route (`/api/studio/motion`) and is swappable.

## The brief (emitted per asset)

Brackets are filled in by the Builder.

```
MOTION ASSET BRIEF — [asset name]
Keyframes: [5] images in order at [W×H]. Each is a checkpoint the animation passes through exactly
(pixel-faithful on its frame). Duration [1.5 s] at [30] fps = [45] frames. Loop: [wrap | ping-pong | once].
Timing: [4|5] gaps of equal length unless a gap is marked longer; hold each keyframe [2] frames;
ease-in-out per gap unless marked linear.
In-between frames must: keep one continuous subject; introduce nothing absent from both neighbouring
keyframes; morph shapes along the shortest path; interpolate colour in OKLCH; keep edges crisp (no
ghosting or double exposure); move each background layer at its own parallax speed; match the style
set below in line weight, palette, grain and lighting.
Style set: [N] reference images — the visual vocabulary, not subjects to copy. [Zero-shot conditioning |
adapter trained on the set].
Used as: [background layer 3 | hero visual | button hover | cursor], [fixed | scrolls], [cover | contain],
parallax [0.4].
Output: WebM (VP9, alpha if keyframes carry alpha) + MP4 fallback + one-row sprite sheet for hover
states; poster = keyframe 1.
Quality gate: reject any frame with artifacts, drift from its keyframe above 2 % of pixels, or flicker
between consecutive frames; regenerate that gap only.
```

## Why the background gets its own layers

A background is rarely one picture. The Builder models it as a stack (base
colour or gradient → texture → image or motion asset → overlay), each layer with
its own opacity, blend, scale, parallax speed and fixed-or-scrolls. A motion
asset is one layer in that stack, so "the fog drifts behind the grain, in
front of the gradient" is a sentence the blueprint can say exactly.
