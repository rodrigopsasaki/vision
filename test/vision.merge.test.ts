import { vision } from "../src"

test("vision.merge creates a new object if key does not exist", async () => {
  await vision.with("merge-new", async () => {
    vision.merge("flags", { a: true })
    expect(vision.get("flags")).toEqual({ a: true })
  })
})

test("vision.merge shallowly merges into existing object", async () => {
  await vision.with("merge-shallow", async () => {
    vision.merge("flags", { a: true })
    vision.merge("flags", { b: false })
    expect(vision.get("flags")).toEqual({ a: true, b: false })
  })
})

test("vision.merge clobbers non-object values", async () => {
  await vision.with("merge-clobber", async () => {
    vision.set("flags", "bad shape")
    vision.merge("flags", { recovered: true })
    expect(vision.get("flags")).toEqual({ recovered: true })
  })
})
