Lantern Control · pane redesign · 2026-10-20

# Pick a look for the PC pane

Three quiet looks, each with its own drawn indicator instead of the circle emojis. All three have the new "On your PC now" strip and Pause / Resume that only exists inside the pane. Rows are example data from today's chat-turns.json.

Look A

## Rail

No icons at all. A thin stripe on each row's left edge: a light sweeps along it while working, solid amber for a question, dashed red when only you can do it, faint blue when done.

**Lantern Control**

On your PC now

blender.exe · v2.0121 · creatures-r3

java · no game test running

creatures-r3

rate v2.0121 BC4-6

spider-moving

waits on your rating, v2.0120 L1-L4

control-pane

building the new pane

warren-r4

paused by you · v2.0114 queued

Closed: pass-613, ring-models, mineshaft-build +9

workingquestiononly youdonepaused

Look B

## Orbit

A small ring per chat. A gap spins round it while working, a halo pulses when it has a question, a notch cuts it when only you can act, and it closes whole when done. Two bars inside means paused.

**Lantern Control**

On your PC now

blender.exe · v2.0121 · 41% done

java · idle

creatures-r3

rate v2.0121 BC4-6

4p

spider-moving

waits on your rating, v2.0120

2p

control-pane

building the new pane

0p

warren-r4

paused by you

5p

Closed: pass-613, ring-models, mineshaft-build +9

Look C

## Wick

A tiny lantern flame drawn per chat, in a monospace pane. The flame flickers while working, glows amber with a question, burns red when only you can act, and settles to a blue ember when done. Paused is a bare wick.

**lantern control**

on your pc now

blender.exe v2.0121 · 3:12

java · idle

creatures-r3

rate v2.0121 bc4-6

spider-moving

waits on your rating

control-pane

building the new pane

warren-r4

paused by you

closed: pass-613, ring-models, mineshaft-build +9

### On your PC now

Read every 5 seconds from Windows itself: each blender.exe and java game test, which pass it is on (from BLENDER.lock), and how long it has run.

### Pause a render

Freezes Blender in place (no work lost, GPU goes quiet). Resume carries on from the same frame. "Stop" stays as before: finish the take, upload, quit.

### Pause a chat

Marks the chat paused in chat-turns.json. Chats check that flag before each new build or render and wait until you press Resume.

### Only in the pane

No chat can press these. The pane writes the pause flags; chats only read them.