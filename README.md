# Manik Rana — Portfolio

Personal portfolio site for Manik Rana — a multi-page Vite build combining
hand-written HTML/CSS/TypeScript pages with small, targeted React "islands"
(mounted via `createRoot` into specific DOM nodes) for a handful of
interactive components. Not a single-page React app: each route is its own
static HTML entry point, and React is used only where it earns its keep.

## Tech Stack

**Build tooling**
- [Vite 5](https://vitejs.dev/) — dev server + multi-page production build
- [TypeScript 5](https://www.typescriptlang.org/) (strict mode, `noEmit` —
  type-checked but not compiled by `tsc`; Vite/esbuild handles the actual
  transpilation)

**Runtime dependencies**
- [React 18](https://react.dev/) / `react-dom` — mounted as islands (e.g.
  the `StaggeredMenu` mobile nav, `ShapeBlur`, `InfiniteSpiral`, `LogoLoop`)
  rather than owning the whole page
- [Three.js](https://threejs.org/) — the curtain-strip hero backgrounds
  (`*-strip-field.ts` on `/lab/lv8/`, `/lab/lv9/`, and the main site's
  "Skill & Fun" section), the `ShapeBlur` effect, and `/lab/lv8/`'s
  Three.js rail-shooter game
- [GSAP](https://gsap.com/) — powers `StaggeredMenu`, the full-screen
  staggered mobile navigation reused across the main site and several
  `/lab/` routes
- [OGL](https://github.com/oframe/ogl) — the `RippleDistortion` WebGL
  cursor effect (`/lab/lv1/`, `/lab/lv6/`)
- [react-icons](https://react-icons.github.io/react-icons/) — skill/tech
  glyph icons in the nav and skills marquees

**Styling**: plain CSS per route (no CSS framework/preprocessor), plus the
Tailwind Play CDN (`<script src="https://cdn.tailwindcss.com">`), loaded
only on pages that render `LogoLoop` (a react-bits component built with
Tailwind utility classes) since the project has no Tailwind build step of
its own.

## Project Structure

This is a **multi-page app**: every route below is its own HTML entry
point, each declared explicitly in `vite.config.js`'s `build.rollupOptions.input`.

```
/            the main site — hero, scroll sections, footer (main.tsx)
/about/      the live About page — scroll-driven panel sequence
/lab/lv1-9/  in-progress/archived experiments (see below)
```

### Routes

| Route | What it is |
|---|---|
| `/` | The live main site — hero, scroll-pinned "stack" section, a sliding "Creative Design" panel, and a footer with a signup form. Includes a "Skill & Fun" section (`skillsfun*` files) toggled in-place as a fifth view alongside Home/Projects/Contact/About, itself a full port of `/lab/lv9/`'s hero → transition → figure section → About → nav grid. |
| `/about/` | The live About page: a placeholder dashboard fades out, then a full-screen, horizontally scroll-driven panel sequence takes over. A deployed copy of `/lab/lv5/`'s content at its own real path. |
| `/lab/lv1/` | Experiment: the watermark cursor effect swapped for the OGL-based `RippleDistortion` effect. |
| `/lab/lv3/` | A copy of the main site with an enhanced footer — bubble-burst effect, a rising watermark, and a site nav that slides back in once you reach the bottom. |
| `/lab/lv4/` | A duplicate of `/lab/lv3/`, plus a background photo cut through the "Creative Design" panel text and a responsive `ShapeBlur` box. |
| `/lab/lv5/` | Standalone build of the About section's scroll-driven panel sequence (development copy; the live version is deployed at `/about/`). |
| `/lab/lv6/` | A duplicate of the main site where clicking "About" triggers a staggered column-wipe transition into a preloaded About iframe instead of a hard navigation. |
| `/lab/lv7/` | A standalone "Projects" page (built from `/lab/lv6/`'s shell) with Home/About transition destinations, an in-page Contact view, a floating nav that decomposes on scroll, and a project index list. |
| `/lab/lv8/` | Fully isolated "Games" hub — its own nav/footer/palette — with a Three.js wormhole rail-shooter game, dynamically imported only when played. |
| `/lab/lv9/` | Fully isolated route: a faithful copy of `/lab/lv8/`'s hero → "Move Next" transition → figure section, extended with its own light-theme About section and a 4-tile nav grid. This is the source the main site's "Skill & Fun" section was ported from. |
| `/lab/home-v0/` | The original vanilla homepage (plain HTML/CSS/JS, no build step), kept archived. |

`/lab/` routes are iterative development/experimentation history — some
feed forward into the live site (`/lab/lv9/` → the main site's "Skill &
Fun" section, `/lab/lv5/` → `/about/`), others are self-contained one-offs
kept for reference.

### Shared components

A handful of root-level `.tsx` files (`StaggeredMenu.tsx`, `ShapeBlur.tsx`,
`InfiniteSpiral.tsx`, `LogoLoop.tsx`) are reused React components, each
duplicated per-route where used rather than imported from a shared
package — routes that need a component keep their own local copy
(`about/StaggeredMenu.tsx`, `lab/lv6/ShapeBlur.tsx`, etc.), so each route's
bundle stays self-contained and one route's tweak to a component never
silently changes another's.

## Getting Started

**Requirements:** Node.js and npm.

```bash
# install dependencies
npm install

# start the dev server (http://localhost:5173)
npm run dev

# type-check the whole project (no emitted output)
npx tsc --noEmit

# production build — outputs static files to dist/
npm run build

# preview the production build locally
npm run preview
```

The dev server includes a small middleware that redirects slash-less
`/lab/*` and `/about` URLs to their canonical trailing-slash form, and
disables caching on `/lab/*` HTML so a stale bundle can't get pinned to a
bare URL during development.

## Build Output

`npm run build` produces a static `dist/` directory (one HTML entry per
route listed above, plus hashed JS/CSS assets) that can be served by any
static host.
