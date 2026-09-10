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
//  - "/lab/home-v0/"  -> the original vanilla homepage, archived (index.html +
//                        styles.css + script.js, no build step of its own)

// Dev-only helpers for the /lab routes:
//  - redirect slash-less URLs (Vite's SPA fallback otherwise serves the root
//    page for "/lab/xxx", which looks like the wrong page)
//  - force no-store on lab HTML so a browser/proxy cache can't pin a stale
//    bundle to the bare URL while a ?query variant loads fresh
const LAB_ROUTES = ["/lab/lv1/", "/lab/lv3/", "/lab/lv4/", "/lab/home-v0/"];
const labDevMiddleware = () => ({
  name: "lab-dev-middleware",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url || "").split("?")[0];
      const target = LAB_ROUTES.find(r => path === r.slice(0, -1));
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
        homeV0: resolve(__dirname, "lab/home-v0/index.html"),
      },
    },
  },
});
