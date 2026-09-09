import { defineConfig } from "vite";
import { resolve } from "path";

// Multi-page setup.
//  - "/"          -> the untouched live homepage (index.html + styles.css + script.js, vanilla)
//  - "/lab/lv1/"  -> experiment: watermark cursor effect swapped for RippleDistortion
//  - "/lab/lv2/"  -> experiment: hero + middle sections + scroll transitions (vanilla, no effects)
//  - "/lab/lv3/"  -> copy of lv2 with an enhanced footer (bubble burst + rising
//                    watermark + site nav that returns at the bottom)
// The homepage never imports any lab code, so it is unaffected by the additions below.

// Dev-only helpers for the /lab experiments:
//  - redirect slash-less URLs (Vite's SPA fallback otherwise serves the root
//    homepage for "/lab/lvN", which looks identical to the real page)
//  - force no-store on lab HTML so a browser/proxy cache can't pin a stale
//    bundle to the bare URL while a ?query variant loads fresh
const LAB_ROUTES = ["/lab/lv1/", "/lab/lv2/", "/lab/lv3/"];
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
        labLv2: resolve(__dirname, "lab/lv2/index.html"),
        labLv3: resolve(__dirname, "lab/lv3/index.html"),
      },
    },
  },
});
