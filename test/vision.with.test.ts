import { vision } from "../src"

test("creates and retrieves a context with canonical fields", async () => {
  await vision.with("test-run", async () => {
    const ctx = vision.context()
    expect(ctx.name).toBe("test-run")
    expect(ctx.id).toMatch(/[a-f0-9-]{36}/)
    expect(ctx.timestamp).toBeTruthy()
  })
})

test("throws if accessing context outside of scope", () => {
  expect(() => vision.context()).toThrow("No active vision context")
})
