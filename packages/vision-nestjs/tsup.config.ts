import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  external: [
    "@nestjs/common",
    "@nestjs/core", 
    "@nestjs/graphql",
    "@nestjs/microservices",
    "@nestjs/websockets",
    "@rodrigopsasaki/vision",
    "rxjs",
    "reflect-metadata"
  ]
});