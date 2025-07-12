import { vision, add, exportTo, registerExporter } from "../src"

registerExporter("console", (ctx) => {
  console.log("EXPORT", Object.fromEntries(ctx.data))
})

test("vision context captures and exports data", async () => {
  let captured: any
  registerExporter("capture", (ctx) => {
    captured = Object.fromEntries(ctx.data)
  })

  await vision("test", async () => {
    add("foo", "bar")
    add("num", 42)
    exportTo("capture")
  })

  expect(captured).toEqual({ foo: "bar", num: 42 })
})
