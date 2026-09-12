import { defineConfig } from "vite";
import { resolve } from "path";

// Multi-page setup.
//  - "/"              -> the main site (hero + scroll sections + RippleDistortion
//                        footer; React islands via main.tsx). Formerly /lab/lv2.
//  - "/lab/lv1/"      -> experiment: watermark cursor effect swapped for RippleDistortion
//  - "/lab/lv3/"      -> copy of the main site with an enhanced footer (bubble burst +
//                        rising watermark + site nav that returns at the bottom)
//  - "/lab/lv4/"      -> full duplicate of /lab/lv3/, plus: a background photo cut
//                        through the "Creative Design" panel text, and a responsive
//                        (not fixed-size) ShapeBlur box in the stack section
//  - "/lab/lv5/"      -> standalone build: the About section. A placeholder
//                        dashboard fades out, then a full-screen, horizontally
//                        scroll-driven sequence takes over (wheel/touch input
//                        translates the panel track sideways instead of the
//                        page scrolling down), including a pinned split/grow
//                        sub-animation on the "THE WORK" panel. Kept around
//                        purely for continued testing — the live "About" nav
//                        link points at /about/ (below), a separate copy.
//  - "/lab/lv6/"      -> full duplicate of the main site, plus one addition:
//                        clicking "About" no longer navigates straight to
//                        /about/ — a staggered column-wipe (lv6-transition.ts)
//                        covers the screen, swaps in the About page (preloaded
//                        the whole time in a hidden iframe, so it's already
//                        fully rendered underneath), then wipes away again to
//                        reveal it. Every other section/effect is untouched.
//  - "/about/"        -> the live About page linked from the main site's nav
//                        (a duplicate of /lab/lv5/'s content, deployed at its
//                        own real path rather than under /lab/)
//  - "/lab/lv7/"      -> new standalone route: a "Projects" page (copied from
//                        /lab/lv6/'s shell — same fonts/footer/nav-shell/
//                        column-strip transition system), extended with two
//                        more transition destinations (Home, About, both
//                        preloaded in hidden iframes like lv6's About) plus a
//                        same-document "Contact" view, a floating nav that
//                        decomposes on scroll, and a 7-project index list.
//  - "/lab/home-v0/"  -> the original vanilla homepage, archived (index.html +
//                        styles.css + script.js, no build step of its own)

// Dev-only helpers:
//  - redirect slash-less URLs for /lab/* and /about (Vite's SPA fallback
//    otherwise serves the root page for these, which looks like the wrong page)
//  - force no-store on /lab/* HTML so a browser/proxy cache can't pin a stale
//    bundle to the bare URL while a ?query variant loads fresh (not applied to
//    /about/, which is a real page, not an in-progress experiment)
const LAB_ROUTES = ["/lab/lv1/", "/lab/lv3/", "/lab/lv4/", "/lab/lv5/", "/lab/lv6/", "/lab/lv7/", "/lab/home-v0/"];
const SITE_ROUTES = ["/about/"];
const labDevMiddleware = () => ({
  name: "lab-dev-middleware",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url || "").split("?")[0];
      const target = [...LAB_ROUTES, ...SITE_ROUTES].find(r => path === r.slice(0, -1));
      if (target || path === "/lab" || path === "/lab/") {
        res.statusCode = 301;
        res.setHeader("Location", target || "/lab/lv1/");
        res.end();
        return;
      }
      if (path.startsWith("/lab/")) {
        res.setHeader("Cache-Control", "no-store, must-revalidate");
      }
      next();
    });
  },
});

export default defineConfig({
  root: ".",
  plugins: [labDevMiddleware()],
  server: { host: true, port: 5173, open: false },
  esbuild: { jsx: "automatic" },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        labLv1: resolve(__dirname, "lab/lv1/index.html"),
        labLv3: resolve(__dirname, "lab/lv3/index.html"),
        labLv4: resolve(__dirname, "lab/lv4/index.html"),
        labLv5: resolve(__dirname, "lab/lv5/index.html"),
        labLv6: resolve(__dirname, "lab/lv6/index.html"),
        labLv7: resolve(__dirname, "lab/lv7/index.html"),
        about: resolve(__dirname, "about/index.html"),
        homeV0: resolve(__dirname, "lab/home-v0/index.html"),
      },
    },
  },
});
