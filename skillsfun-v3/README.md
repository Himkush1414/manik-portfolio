# Skills & Fun v3

The Skills & Fun view, ported from the hand-built lab (`portfolio-skills-fun-lab-v3`):
the neon tube reveal, scroll fade, iris reveal into the figure section, About,
the four boxes and the rising-lines footer.

- `sf3.css`: the lab's compiled CSS (Tailwind v4 utilities + the section's own
  CSS), with every selector scoped under `#skillsfun-root` and cascade layers
  unwrapped, so it can't reach any other view and the global CSS can't override it.
  It is generated; it's not meant to be edited by hand.
- `fonts/`: Inter 900, the one face the global `fonts.css` doesn't already load.

## How it's wired into the page

- `index.html` keeps the view container, `<div id="skillsfun-root">`. Its old static
  markup and the old `skillsfun.css` link are gone; the old files themselves are
  still in the repo, unused (no cleanup in this port).
- `main.tsx` lazy-loads `skillsfun-v3/mount.tsx`: on idle after `load`, or straight
  away when the page opens on `#skills` or a Skills link is clicked first.
- `mount.tsx` renders `SkillsFunV3` into the container. `lv6-transition.ts` still
  shows and hides it, so the Skills tab, the strip transition and every exit keep
  working. Each time the view is entered again it restarts at the tube light.
- Exits are plain links (`/`, `/about`, `#projects`, `#skills`, `#privacy`,
  `#terms`, `#contact`) handled by `lv6-transition.ts`'s document-level click
  handler. The section's Contact buttons go through `a[href="#contact"]`, because
  `lv6-transition.ts` binds their ids before this view exists.

## Click-test

`skillsfun-v3/qa/click-test.mjs` drives a built site with Playwright + Chrome. It
covers Home → Skills tab → ignition → scroll reveal → section, re-entering the
view, and a direct `/#skills` load. It also clicks every exit (figure menu and
Contact, Let's Connect, the three box links, Connect with Me, every footer link),
the logo's way back to the start, and the colour picker. It reports pass/fail per
step, plus console errors and horizontal scroll:

    npm run build
    python3 -m http.server 4173 --directory dist      # or any static server
    node skillsfun-v3/qa/click-test.mjs http://localhost:4173/ qa-out 1440 900
    node skillsfun-v3/qa/click-test.mjs http://localhost:4173/ qa-out-m 390 844
