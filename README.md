# Quinta da Libélula — website concept

A standalone, front-end-only demonstration of what a new digital home for
[Quinta da Libélula](https://quintadalibelula.center) could feel like. It is a
concept to present, not the official site, and it never touches the live
website, its hosting or its content.

## Run it

```bash
npm install
npm run dev      # http://localhost:5390
npm run build    # static files in dist/ (relative paths, host anywhere)
```

Handy links while presenting:

- `/?skip` opens straight on the homepage.
- `/?intro=canvas` always plays the intro (after a visit it is skipped for 7 days).
- `/?intro=still` shows the still welcome that reduced-motion visitors get.
- `/?intro=film` plays the Blender film instead, once its video is in `public/intro/`.
- Press **Escape** during the intro to jump to the invitation.
- To see the intro again, use "Watch the dragonfly again" in the footer.

## The journey

1. **The melting dragonfly** (`src/intro/`). The Prismatic Dragonfly (the Meshy
   model, live in 3D) flies into a sunlit forest and hovers, leaning toward the
   pointer. Then it melts: a snapshot of the real model becomes pigment, so its
   own iridescent colours flow into petals, watercolour blooms and golden
   nectar. The pigment travels through the air and settles into the Quinta's
   emblem, and "Enter the Experience" appears. Every beat is time-boxed and
   there's a skip button. Reduced motion gets a still welcome. Without WebGL,
   or on low-memory devices, the hand-drawn dragonfly stands in.
   - `engine.ts` is the canvas engine with no React in it, so the sequence can
     be refined or reused alone. Timings live in `TIMELINE`.
   - `dragonfly3d.ts` draws the 3D model at the pose the engine decides.
   - `DragonflyIntro.tsx` is the reusable component: `<DragonflyIntro emblemSrc onEnter />`.
   - `IntroTransition.tsx` is the bloom of light that opens into the site.
   - **Enter the Experience:** the emblem melts back into pigment, and the pigment
     re-forms in the exact shape and colours of the Prismatic Lotus Dragonfly. The
     real 3D model resolves out of it, the forest dissolves into the homepage, and
     the dragonfly flies to its place in the hero (`REBIRTH` in `engine.ts`).
2. **Homepage** (`SanctuaryHomepage`): layered mountain parallax and mist. The
   reborn Prismatic Lotus Dragonfly (`src/three/HeroDragonfly.tsx`, live 3D)
   takes over from the intro at the same spot (or, if you skipped the intro,
   flies in) and hovers beside the line "Some
   places invite you to visit. Others invite you to return to yourself." It
   drifts away as you scroll.
3. **Sanctuary**, then **a pause for one guided breath** (`BreathPause`).
4. **Retreats** (`RetreatExplorer`): tilting arch cards that open a drawer, with
   enquiry wired to the form.
5. **Stay** (`AccommodationExplorer`): six domes you can light up, and an
   explorer for the 4-, 2- and 1-person domes and the teepee tents (illustrated).
6. **Practices** (`PracticesSection`): on wide screens the section pins and you
   walk sideways along a path of practices; on phones it's a simple stack.
7. **The Land** (`LandExperience`): an illustrated map with places to tap and a
   dawn / day / dusk / night switch (fireflies after dark).
8. **Community**: guests' words and moments from the gallery.
9. **Enquire** (`ContactSection`): a demo form that sends nothing and stores nothing.

## Facts and demo content

All facts come from the public site, read on 10 Nov 2026, and live in
`src/content/site.ts`. Anything the site doesn't say is labelled on the page:

- Retreat names, dates and day plans are **examples** built around the
  practices the site names (Himalayan Yoga, Tantric practices, healing circles,
  ceremony, stillness).
- Which chakra and colour belongs to each dome isn't on the site, so the dome
  colours are marked **illustrative**.
- The land map is **illustrative and not to scale**.
- The phone number is left out because the site prints it in an unusual format.

## Images

Photographs and logos are local copies from quintadalibelula.center (no
hotlinking), resized by `npm run images` from originals kept in `raw-assets/`
(not committed). The forest, dragonfly, teepee, map and dome art are drawn in
code.

## The 3D dragonflies

`public/models/` holds web versions of both Meshy models (about 850 KB each:
70k triangles, Draco compression, WebP textures, and the same rig as the film).
They are made by `blender/scripts/export_web_models.py` from the originals in
`blender/source/`. The Draco decoder is served locally from `public/draco/`.
`src/three/dragonflyModel.ts` loads them and adds thin-film iridescence,
translucent wings and wingbeats on the rig. Hind wings lead the fore wings by a
quarter beat.

## Stack

React 18 + TypeScript + Vite, GSAP (ScrollTrigger) for scroll motion, and
Canvas 2D for the intro. Three.js was left out on purpose: the effect doesn't
need it, and Canvas 2D keeps the intro light on phones.
