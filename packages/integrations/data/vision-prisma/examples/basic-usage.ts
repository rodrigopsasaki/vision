import { PrismaClient } from "@prisma/client";
import { vision } from "@rodrigopsasaki/vision";
import { instrumentPrisma } from "../src";

// Initialize Vision with a simple console exporter
vision.init({
  exporters: [
    {
      name: "console",
      success: (ctx) => {
        console.log("✅ Operation completed:", {
          id: ctx.id,
          name: ctx.name,
          duration: Date.now() - new Date(ctx.timestamp).getTime(),
          data: Object.fromEntries(ctx.data),
        });
      },
      error: (ctx, err) => {
        console.error("❌ Operation failed:", {
          id: ctx.id,
          name: ctx.name,
          error: err,
          data: Object.fromEntries(ctx.data),
        });
      },
    },
  ],
});

// Create and instrument your Prisma client - that's all you need!
const prisma = instrumentPrisma(new PrismaClient());

async function main() {
  console.log("🚀 Vision Prisma Basic Example");
  console.log("📊 All database operations are automatically tracked\n");

  // Example 1: Simple query
  await vision.observe("example.find-users", async () => {
    console.log("Finding all users...");
    const users = await prisma.user.findMany();

    // Vision automatically captures:
    // - database.operation: "user.findMany"
    // - database.duration_ms: <execution time>
    // - database.result_count: <number of users>
    // - database.success: true

    vision.set("total_users", users.length);
    console.log(`Found ${users.length} users\n`);
  });

  // Example 2: Create operation
  await vision.observe("example.create-user", async () => {
    console.log("Creating a new user...");
    const newUser = await prisma.user.create({
      data: {
        email: `user-${Date.now()}@example.com`,
        name: "John Doe",
      },
    });

    vision.set("user_id", newUser.id);
    vision.set("user_email", newUser.email);
    console.log(`Created user: ${newUser.email}\n`);
  });

  // Example 3: Find with conditions
  await vision.observe("example.find-by-email", async () => {
    console.log("Finding user by email...");
    const user = await prisma.user.findFirst({
      where: {
        email: {
          contains: "@example.com",
        },
      },
    });

    vision.set("found_user", !!user);
    if (user) {
      vision.set("user_id", user.id);
    }
    console.log(`User found: ${!!user}\n`);
  });

  // Example 4: Update operation
  await vision.observe("example.update-users", async () => {
    console.log("Updating users...");
    const result = await prisma.user.updateMany({
      where: {
        email: {
          contains: "@example.com",
        },
      },
      data: {
        updatedAt: new Date(),
      },
    });

    vision.set("updated_count", result.count);
    console.log(`Updated ${result.count} users\n`);
  });

  // Example 5: Transaction example
  await vision.observe("example.transaction", async () => {
    console.log("Running transaction...");
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `transactional-${Date.now()}@example.com`,
          name: "Transaction User",
        },
      });

      // Each operation within the transaction is also tracked!
      const count = await tx.user.count();

      vision.set("transaction_user_id", user.id);
      vision.set("total_users_after_transaction", count);

      return { user, count };
    });

    console.log(`Transaction completed. Total users: ${result.count}\n`);
  });

  // Example 6: Error handling
  await vision.observe("example.error-handling", async () => {
    console.log("Demonstrating error handling...");
    try {
      await prisma.user.create({
        data: {
          email: "duplicate@example.com",
          name: "Duplicate User",
        },
      });

      // Try to create again with same email (assuming unique constraint)
      await prisma.user.create({
        data: {
          email: "duplicate@example.com",
          name: "Another Duplicate",
        },
      });
    } catch (error) {
      // Vision automatically captures:
      // - database.success: false
      // - database.error: <error message>
      // - database.duration_ms: <execution time>

      vision.set("error_type", "unique_constraint_violation");
      console.log("Error captured by Vision (this is expected)\n");
    }
  });

  // Example 7: Raw query
  await vision.observe("example.raw-query", async () => {
    console.log("Running raw query...");
    const users = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "User"`;

    vision.set("raw_query_result", users);
    console.log(`Raw query completed\n`);
  });
}

// Run the examples
main()
  .catch((error) => {
    console.error("Example failed:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n✨ Examples completed! Check the console output above to see Vision tracking.");
  });
