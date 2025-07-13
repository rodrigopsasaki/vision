import { vision } from "../src"

test("vision.exportTo invokes the correct registered exporter", async () => {
  const out: Record<string, unknown> = {}

  vision.registerExporter("capture", (ctx) => {
    Object.assign(out, Object.fromEntries(ctx.data))
  })

  await vision.with("export", async () => {
    vision.set("x", 1)
    vision.exportTo("capture")
  })

  expect(out).toEqual({ x: 1 })
})

test("vision.exportTo throws if exporter is not registered", async () => {
  await vision.with("missing-exporter", async () => {
    expect(() => vision.exportTo("nope")).toThrow("Exporter 'nope' not found")
  })
})
