// HUD layout state shared by the mission scene and the DOM HUD (plain
// object, read per frame; no React state): which view the HUD is drawn for
// (overlay in third / chase, light combiner overlay in the cockpit).
export const hudView = {
  /** the cockpit interior is shown: diegetic MFDs + combiner, the overlay goes light */
  cockpit: false,
};
