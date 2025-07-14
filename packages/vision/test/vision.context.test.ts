import { vision } from "../src"

test("context is preserved across function boundaries", async () => {
  function layer1() {
    return layer2()
  }
  function layer2() {
    return vision.get("depth")
  }

  await vision.with("deep-call", async () => {
    vision.set("depth", "infinite")
    const result = layer1()
    expect(result).toBe("infinite")
  })
})

test("context is preserved across async boundaries", async () => {
  async function doAsync() {
    await new Promise((r) => setTimeout(r, 1))
    return vision.get("id")
  }

  await vision.with("async-call", async () => {
    vision.set("id", 42)
    const result = await doAsync()
    expect(result).toBe(42)
  })
})

test("context works with Promise.then chains", async () => {
  await vision.with("promise-then", async () => {
    vision.set("x", 123)
    const result = await Promise.resolve().then(() => vision.get("x"))
    expect(result).toBe(123)
  })
})

test("nested vision.with calls preserve isolation", async () => {
  await vision.with("outer", async () => {
    vision.set("scope", "outer")

    await vision.with("inner", async () => {
      vision.set("scope", "inner")
      expect(vision.get("scope")).toBe("inner")
    })

    expect(vision.get("scope")).toBe("outer")
  })
})

test("throws if accessing context after async root completes", async () => {
  let access: () => void = () => {}

  await vision.with("expired", async () => {
    access = () => vision.get("x")
  })

  expect(() => access()).toThrow("No active vision context")
})
