import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2020",
  outDir: "dist",
  dts: true,
  clean: true,
  sourcemap: false,
  minify: false,
  shims: false,
  treeshake: true,
})
