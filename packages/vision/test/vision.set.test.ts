import { vision } from "../src"

test("vision.set stores scalar values", async () => {
  await vision.with("set-scalar", async () => {
    vision.set("foo", "bar")
    vision.set("num", 42)
    expect(vision.get("foo")).toBe("bar")
    expect(vision.get("num")).toBe(42)
  })
})

test("vision.set overwrites previous values", async () => {
  await vision.with("set-overwrite", async () => {
    vision.set("key", "one")
    vision.set("key", "two")
    expect(vision.get("key")).toBe("two")
  })
})
