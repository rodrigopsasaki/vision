/**
 * Advanced Vision TypeORM Integration Example
 *
 * This example demonstrates advanced configuration options, transaction
 * instrumentation, and decorator-based observability.
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { vision } from "@rodrigopsasaki/vision";
import {
  instrumentDataSource,
  visionTransaction,
  visionTransactionWithIsolation,
  VisionInstrumented,
  VisionObserve,
  VisionParam,
  type VisionTypeOrmConfig,
} from "@rodrigopsasaki/vision-typeorm";

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string; // Will be automatically redacted in logs

  @Column({ default: 0 })
  loginCount!: number;
}

@Entity()
class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("decimal", { precision: 10, scale: 2 })
  amount!: number;

  @Column()
  userId!: number;

  @Column({ default: "pending" })
  status!: string;
}

// Advanced configuration with security and performance considerations
const advancedConfig: VisionTypeOrmConfig = {
  enabled: true,
  logParams: true, // Enable parameter logging
  logQuery: true, // Log actual SQL queries
  logResultCount: true,
  maxQueryLength: 500, // Prevent huge queries from bloating logs
  includeEntityInName: true,
  operationPrefix: "database", // Custom prefix
  redactFields: ["password", "token", "secret", "ssn", "creditCard"], // Enhanced security
  logConnectionInfo: true, // Include database connection details
  instrumentTransactions: true,
  instrumentRepositories: true,
  instrumentEntityManager: true,
};

// Service class with decorator-based instrumentation
@VisionInstrumented({
  logParams: true,
  operationPrefix: "service",
})
class UserService {
  constructor(private dataSource: DataSource) {}

  @VisionObserve()
  async createUser(@VisionParam("userData") userData: Partial<User>) {
    const userRepository = this.dataSource.getRepository(User);
    return await userRepository.save(userData);
  }

  @VisionObserve()
  async findUserByEmail(@VisionParam("email") email: string) {
    const userRepository = this.dataSource.getRepository(User);
    return await userRepository.findOne({ where: { email } });
  }

  async incrementLoginCount(userId: number) {
    // This method uses manual Vision observability
    return vision.observe("service.user.incrementLogin", async () => {
      vision.set("user_id", userId);

      const userRepository = this.dataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });

      if (!user) {
        vision.set("error", "user_not_found");
        throw new Error("User not found");
      }

      user.loginCount += 1;
      const updatedUser = await userRepository.save(user);

      vision.set("new_login_count", updatedUser.loginCount);
      return updatedUser;
    });
  }
}

async function advancedExample() {
  // Initialize DataSource
  const dataSource = new DataSource({
    type: "postgres", // Using PostgreSQL for more advanced features
    host: "localhost",
    port: 5432,
    username: "user",
    password: "password",
    database: "vision_example",
    entities: [User, Order],
    synchronize: true,
  });

  await dataSource.initialize();

  // Instrument with advanced configuration
  const instrumentedDataSource = instrumentDataSource(dataSource, advancedConfig);
  const userService = new UserService(instrumentedDataSource);

  // Example 1: Complex transaction with error handling
  try {
    const result = await visionTransactionWithIsolation(
      instrumentedDataSource,
      "READ COMMITTED",
      async (manager) => {
        // Create user
        const user = await userService.createUser({
          name: "Alice Johnson",
          email: "alice@example.com",
          password: "secure_password_123",
        });

        // Create multiple orders in the same transaction
        const orderRepository = manager.getRepository(Order);
        const orders = await Promise.all([
          orderRepository.save({ amount: 99.99, userId: user.id, status: "pending" }),
          orderRepository.save({ amount: 149.5, userId: user.id, status: "pending" }),
          orderRepository.save({ amount: 75.25, userId: user.id, status: "pending" }),
        ]);

        // Calculate total order value
        const totalAmount = orders.reduce((sum, order) => sum + Number(order.amount), 0);

        // Business logic: Apply discount for high-value customers
        if (totalAmount > 200) {
          vision.set("discount_applied", true);
          vision.set("discount_amount", totalAmount * 0.1);

          // Update all orders with discount
          for (const order of orders) {
            order.amount = Number(order.amount) * 0.9;
            await orderRepository.save(order);
          }
        }

        return { user, orders, totalAmount };
      },
    );

    console.log("Transaction completed successfully:", result);
  } catch (error) {
    console.error("Transaction failed:", error);
  }

  // Example 2: Manual query runner for complex operations
  await vision.observe("data.migration", async () => {
    vision.set("operation_type", "bulk_update");

    const queryRunner = instrumentedDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bulk operation with raw SQL
      const result = await queryRunner.query(
        `UPDATE "user" SET "loginCount" = "loginCount" + 1 
         WHERE "email" LIKE $1`,
        ["%@example.com"],
      );

      vision.set("affected_rows", result.affectedRows);

      await queryRunner.commitTransaction();

      vision.set("migration_status", "completed");
    } catch (error) {
      await queryRunner.rollbackTransaction();
      vision.set("migration_status", "failed");
      throw error;
    } finally {
      await queryRunner.release();
    }
  });

  // Example 3: Complex queries with relationships
  await vision.observe("analytics.user_orders", async () => {
    const userRepository = instrumentedDataSource.getRepository(User);
    const orderRepository = instrumentedDataSource.getRepository(Order);

    // Find users with their order statistics
    const users = await userRepository
      .createQueryBuilder("user")
      .leftJoin("order", "order", "order.userId = user.id")
      .select("user.id", "userId")
      .addSelect("user.name", "userName")
      .addSelect("COUNT(order.id)", "orderCount")
      .addSelect("COALESCE(SUM(order.amount), 0)", "totalSpent")
      .groupBy("user.id")
      .having("COUNT(order.id) > :minOrders", { minOrders: 1 })
      .getRawMany();

    vision.set("user_count", users.length);
    vision.set("analytics_type", "user_order_summary");

    // Additional complex query for order analysis
    const orderStats = await orderRepository
      .createQueryBuilder("order")
      .select("order.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("AVG(order.amount)", "avgAmount")
      .addSelect("SUM(order.amount)", "totalAmount")
      .groupBy("order.status")
      .getRawMany();

    vision.set("order_statistics", orderStats);

    return { users, orderStats };
  });

  await dataSource.destroy();
}

/**
 * Advanced output includes detailed database observability:
 *
 * Transaction observability:
 * {
 *   "name": "database.transaction.isolated",
 *   "data": {
 *     "database.operation": "transaction",
 *     "database.isolation_level": "READ COMMITTED",
 *     "database.query_count": 6,
 *     "database.success": true,
 *     "database.duration_ms": 145,
 *     "discount_applied": true,
 *     "discount_amount": 32.474
 *   }
 * }
 *
 * Individual operations with security:
 * {
 *   "name": "database.user.save",
 *   "data": {
 *     "database.operation": "save",
 *     "database.entity": "User",
 *     "database.params": [{
 *       "name": "Alice Johnson",
 *       "email": "alice@example.com",
 *       "password": "[REDACTED]"  // Automatically redacted
 *     }],
 *     "database.query": "INSERT INTO user (name, email, password) VALUES ($1, $2, $3)",
 *     "database.provider": "typeorm",
 *     "database.driver": "postgres"
 *   }
 * }
 */

if (require.main === module) {
  advancedExample().catch(console.error);
}
