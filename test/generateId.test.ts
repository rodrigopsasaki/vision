import { describe, expect, it } from "vitest"

import { generateId } from "../src/utils/generateId"

describe("generateId", () => {
  it("should generate a valid UUID v4", () => {
    const id = generateId()

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    expect(id).toMatch(uuidV4Regex)
  })

  it("should generate unique IDs", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId())
    }

    expect(ids.size).toBe(1000)
  })
})
