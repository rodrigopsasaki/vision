import { vision } from "../src"

test("vision.push creates a new array if key does not exist", async () => {
  await vision.with("push-new", async () => {
    vision.push("events", "created")
    expect(vision.get("events")).toEqual(["created"])
  })
})

test("vision.push appends to an existing array", async () => {
  await vision.with("push-append", async () => {
    vision.push("steps", "a")
    vision.push("steps", "b")
    expect(vision.get("steps")).toEqual(["a", "b"])
  })
})

test("vision.push clobbers non-array values", async () => {
  await vision.with("push-clobber", async () => {
    vision.set("logs", "oops")
    vision.push("logs", "recovered")
    expect(vision.get("logs")).toEqual(["recovered"])
  })
})
