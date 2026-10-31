# Skills & Fun v3

The Skills & Fun view, ported from the hand-built lab (`portfolio-skills-fun-lab-v3`):
the neon tube reveal, scroll fade, iris reveal into the figure section, About,
the four boxes and the rising-lines footer.

- `sf3.css`: the lab's compiled CSS (Tailwind v4 utilities + the section's own
  CSS), with every selector scoped under `#skillsfun-root` and cascade layers
  unwrapped, so it can't reach any other view and the global CSS can't override it.
  It is generated; it's not meant to be edited by hand.
- `fonts/`: Inter 900, the one face the global `fonts.css` doesn't already load.
