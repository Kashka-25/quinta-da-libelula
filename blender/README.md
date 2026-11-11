# The Dragonfly Transformation — Blender film

The signature opening of the Quinta da Libélula concept: a 27-second film in
which the iridescent dragonfly flies into a forest clearing, surrenders, melts
into molten glass, becomes a living chrysalis, and is reborn as the evolved
lotus dragonfly that flies toward us in a bloom of light. It ends on the site's
ivory, where the website takes over.

Everything is built by Python scripts from the two Meshy models, so the whole
`.blend` can be regenerated in about two minutes.

## Files

```
blender/
  source/                       the Meshy models (not in git, see below)
    dragonfly_meshy.glb           "Prismatic Dragonfly" – the original
    dragonfly_reborn_meshy.glb    "Prismatic Lotus Dragonfly" – the reborn
  reference/                    the two concept images the models came from
  dragonfly_transformation.blend   built by the script (not in git)
  renders/                      frame sequences (not in git)
  scripts/
    build_scene.py              builds and saves the whole film
    render_frames.py            renders chosen moments or a frame range
    encode_video.py             turns frames into MP4 / WebM (Blender's FFmpeg)
    inspect_model.py            prints a model's structure and renders look-dev stills
    qdl/
      common.py                 the timeline (seconds), paths, helpers
      env.py                    forest, light, mist, pollen
      dragonfly.py              import, auto-rig, materials, the melt deformer
      performance.py            flight, hover, wingbeats, surrender
      liquid.py                 the molten-glass simulation (metaballs)
      chrysalis.py              the chrysalis, its breathing, cracks and opening
      rebirth.py                the reborn dragonfly, its unfolding, flight and trail
      cinema.py                 camera, depth of field, the light bloom, the ivory end
      render_setup.py           render presets
```

## The story and its timing

All timing lives in `T` in `qdl/common.py` (seconds at 24 fps). Change a number
and rebuild.

| Time | Act | What happens |
| --- | --- | --- |
| 0–4.6 s | I. Arrival | Darkness, then morning light through the canopy. The dragonfly flies in from the depth of the forest, banks, rears up and hovers in front of us. Hind wings lead fore wings by a quarter beat, each wing slightly different. |
| 4.6–7.4 s | II. Surrender | The wingbeat slows to stillness. Iridescence intensifies, liquid ripples run under the surface, the wings fold inward, the abdomen softens and lengthens. |
| 7.4–12.6 s | III. Melting | Wing tips first, then the abdomen from the tail up, then the head. The surface turns to molten glass and droops; drops swell, stretch on thin threads, and snap. Most of the glass is held by surface tension in one hanging, turning mass; some drops fall away. |
| 12.4–17 s | IV. Chrysalis | The liquid rises in a spiral and settles into a chrysalis that forms from the bottom up: seven twisted petals of iridescent glass with gold veins around a seed of light, hanging from a gold thread. It breathes, pulses, and drips from its tip. |
| 17–23.6 s | VI. Rebirth | Gold cracks spread, a band of light runs up the surface, and the chrysalis opens like a lotus while its petals melt away as nectar. The reborn dragonfly rises as a luminous silhouette, unfolds its four wings while gold runs out along the veins, and hovers with a golden aura. |
| 23.6–27 s | V. Awakening | It flies up and toward us, trailing light. A bubble of liquid light blooms from where it hovered, rolls toward the lens and swallows us, settling to ivory. |

Acts V and VI swap places from the brief on purpose: the rebirth now leads
into the awakening, so the film ends with the new dragonfly opening the doorway.

## How it's built

- **The models.** Each Meshy model is one textured mesh of about 1 million
  triangles in roughly 1,000 loose pieces, with no rig and no separate wings.
  The build decimates it to 25% (the look holds up at video size), then reads
  the rest shape and stores per-vertex attributes: `wing`, `span` (root to tip),
  `fore` (fore or hind wing, found by clustering), and `melt_order`. The
  textures are kept as Meshy made them.
- **The rig.** An armature is built to fit each model: root, thorax, head, a
  five-bone abdomen and four wings, weighted from those attributes. Wing poses
  are set as rotations about the body axis (flap), the wing plane (sweep back)
  and toward the back (fold in), so the same controls drive both dragonflies.
- **Materials.** Meshy's material is extended, not replaced: translucent wings,
  thin-film iridescence, a glow control, and for the original a blend into
  molten glass driven by the melt. The reborn gets a luminous-silhouette
  control and a gold band that travels from wing root to tip.
- **The melt.** `QDL_Melt` (Geometry Nodes) ripples the surface, then droops
  and flows each part as the melt front passes it, and writes a `melt`
  attribute the material reads.
- **The liquid.** One metaball object (about 600 elements), so blobs, threads
  and drops merge with real surface tension. The motion is a small hand-written
  simulation (heavy gravity, viscous drag, threads that stretch and snap,
  cohesion, a spiral vortex) baked to keyframes. It needs no fluid cache, and
  it's deterministic.
- **The chrysalis.** A separate procedural mesh, not a simulation. Its glass,
  veins, cracks, energy band, reveal and dissolve are all shader controls with
  keyframes.
- **Particles.** Pollen and the reborn's light trail are point clouds aged in
  Geometry Nodes by scene time, so there's nothing to bake.

## Commands

From the `QuintaDaLibelula` folder (Blender 5.2):

```bash
# 1. build the film (about 2 minutes); writes blender/dragonfly_transformation.blend
blender -b -P blender/scripts/build_scene.py

# 2. check a few moments quickly (seconds)
blender -b blender/dragonfly_transformation.blend -P blender/scripts/render_frames.py -- --preset draft --at 4 10 15 21

# 3. render every frame (resumable)
blender -b blender/dragonfly_transformation.blend -P blender/scripts/render_frames.py -- --preset preview --range 1 648 --resume --out blender/renders/preview

# 4. encode for the web, then move the MP4 index to the front
blender -b --factory-startup -P blender/scripts/encode_video.py -- blender/renders/preview public/intro/dragonfly-transformation-720.mp4 1280 720 MEDIUM
blender -b --factory-startup -P blender/scripts/encode_video.py -- blender/renders/preview public/intro/dragonfly-transformation-540.webm 960 540 LOW
blender -b --factory-startup -P blender/scripts/encode_video.py -- blender/renders/preview public/intro/dragonfly-transformation-540.mp4 960 540 LOW
node scripts/faststart.mjs public/intro/dragonfly-transformation-720.mp4
node scripts/faststart.mjs public/intro/dragonfly-transformation-540.mp4
```

On Windows, `blender` is `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"`.

Render presets (`qdl/render_setup.py`): `draft` 960×540, `preview` 1280×720
(what the site uses now: about 15 s a frame, roughly 3 hours on this laptop's
integrated graphics), `final` 1920×1080, `portrait` 1080×1920 for a phone cut.
On a machine with a dedicated GPU, render `final` and encode a 1080p file too.

## In the website

The default welcome is the live one: the Meshy dragonfly in 3D, melting into
the emblem (see the main README). The film is ready as an alternative and plays
with `?intro=film` once its videos are in `public/intro/`. It's played by
`src/intro/CinematicIntro.tsx`, and `src/intro/introChoice.ts` decides which
welcome each visitor gets:

| Visitor | Welcome |
| --- | --- |
| First visit | The live 3D melting dragonfly. With `?intro=film`, the film: MP4 (H.264) first, WebM (VP9) as a fallback, and a 540p cut for phones and data-saver connections. |
| Saw it in the last 7 days | Straight to the homepage. The footer has "Watch the dragonfly again". |
| Prefers reduced motion | The still, illustrated welcome. |
| Low memory, data saver or no WebGL | The hand-drawn canvas dragonfly. |
| Film missing, blocked or slow to start (4.5 s) | Falls back to the melting dragonfly. |

The web versions of both models (`public/models/`) come from
`blender/scripts/export_web_models.py`:

```bash
blender -b -P blender/scripts/export_web_models.py -- --tris 70000 --tex 1024
```

The film plays muted, so browsers allow autoplay. Escape or "Skip intro" goes
straight in. In the last 0.9 s an ivory veil covers the video, the Quinta's
logo appears for a breath, and the site opens with the same ivory light bloom
the canvas intro uses. On portrait phones the video is shown wider than the
screen, so the whole wingspan stays in view and the top and bottom fade into
the dark.

`?intro=film`, `?intro=canvas` and `?intro=still` force a version for presenting.

### Delivery choices

- **Video over real-time 3D.** Metaballs, refraction, volumetric light and two
  1-million-triangle models aren't feasible in a browser, especially on phones.
  Pre-rendered video gives the full look: 8 MB at 720p, 3 MB for phones (540p).
- **No alpha video.** The film has its own environment, so it needs no
  transparency. That avoids WebM-alpha and HEVC-alpha support gaps.
- **Two sizes, two codecs.** Phones fetch the smaller cut. The MP4 (H.264)
  comes first because Blender's VP9 encoder makes larger files at the same
  quality, so there is a single 540p WebM, used only as a fallback. The MP4 is rewritten "faststart" so
  Safari can begin before the file finishes.
- **A keyframe every second.** This keeps skipping cheap.

## Not in git

The Meshy models (61 MB and 75 MB), the `.blend` (about 100 MB) and the frame
renders are too large for a normal git repository. They live beside the
scripts on this machine and are listed in `.gitignore`. The scripts rebuild
everything from the two models. If the team wants them versioned, use Git LFS.
