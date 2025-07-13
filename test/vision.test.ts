import { vision } from "../src"

vision.registerExporter("console", (ctx) => {
  console.log("EXPORT", Object.fromEntries(ctx.data))
})

test("vision context captures and exports data", async () => {
  let captured: any
  vision.registerExporter("capture", (ctx) => {
    captured = Object.fromEntries(ctx.data)
  })

  await vision.with("test", async () => {
    vision.set("foo", "bar")
    vision.set("num", 42)
    vision.exportTo("capture")
  })

  expect(captured).toEqual({ foo: "bar", num: 42 })
})
