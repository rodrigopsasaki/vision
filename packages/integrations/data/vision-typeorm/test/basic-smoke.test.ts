import { describe, it, expect } from "vitest";

describe("Vision TypeORM Package Smoke Tests", () => {
  it("should import decorators without errors", async () => {
    const decorators = await import("../src/decorators");
    expect(decorators.VisionInstrumented).toBeDefined();
    expect(decorators.VisionObserve).toBeDefined();
    expect(decorators.VisionEntity).toBeDefined();
    expect(decorators.VisionParam).toBeDefined();
  });

  it("should import instrumentation functions without errors", async () => {
    const instrumentation = await import("../src/instrumentTypeOrm");
    expect(instrumentation.instrumentDataSource).toBeDefined();
    expect(instrumentation.instrumentRepository).toBeDefined();
  });

  it("should import transaction functions without errors", async () => {
    const transactions = await import("../src/transactions");
    expect(transactions.visionTransaction).toBeDefined();
    expect(transactions.visionTransactionWithIsolation).toBeDefined();
    expect(transactions.visionQueryRunner).toBeDefined();
  });

  it("should import utils without errors", async () => {
    const utils = await import("../src/utils");
    expect(utils.createOperationName).toBeDefined();
    expect(utils.redactSensitiveData).toBeDefined();
    expect(utils.DEFAULT_CONFIG).toBeDefined();
  });

  it("should import main index without errors", async () => {
    const main = await import("../src/index");
    expect(main.VisionInstrumented).toBeDefined();
    expect(main.instrumentDataSource).toBeDefined();
    expect(main.visionTransaction).toBeDefined();
  });
});