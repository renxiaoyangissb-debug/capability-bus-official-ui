import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssMinify: false,
    sourcemap: false,
    target: "es2022"
  },
  server: {
    host: "127.0.0.1",
    strictPort: true
  },
  preview: {
    host: "127.0.0.1",
    strictPort: true
  }
});
