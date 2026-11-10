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
- `/?intro=still` shows the still welcome that reduced-motion visitors get.
- Press **Escape** during the intro to jump to the invitation.

## The journey

1. **The melting dragonfly** (`src/intro/`). A dragonfly hovers in a sunlit forest
   (it follows the pointer a little), then melts: wings first, then the body,
   into pigment, petals, watercolour blooms and golden nectar. The pigment
   travels through the air and settles into the Quinta's own emblem, then
   "Enter the Experience" appears. Every beat is time-boxed, there's a skip
   button, and reduced motion or no canvas gets a still illustrated welcome.
   - `engine.ts` is the canvas engine with no React in it, so the sequence can
     be refined or reused alone. Timings live in `TIMELINE`.
   - `DragonflyIntro.tsx` is the reusable component: `<DragonflyIntro emblemSrc onEnter />`.
   - `IntroTransition.tsx` is the bloom of light that opens into the site.
2. **Homepage** (`SanctuaryHomepage`): layered mountain parallax, mist, a small
   dragonfly that crosses the sky, and the line "Some places invite you to
   visit. Others invite you to return to yourself."
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

## Stack

React 18 + TypeScript + Vite, GSAP (ScrollTrigger) for scroll motion, and
Canvas 2D for the intro. Three.js was left out on purpose: the effect doesn't
need it, and Canvas 2D keeps the intro light on phones.
