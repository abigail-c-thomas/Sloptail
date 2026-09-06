import { defineConfig } from "vite";

// No React plugin: Vite's bundled esbuild compiles JSX. We lose in-place hot
// reload (edits trigger a full page reload) and gain zero extra dependencies.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  server: {
    // `wrangler dev` (apps/server) listens on 8787; the SPA proxies API calls there.
    proxy: { "/api": "http://localhost:8787" },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
