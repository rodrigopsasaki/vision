/**
 * Performance-Optimized Vision TypeORM Integration Example
 *
 * This example demonstrates how to configure Vision TypeORM integration
 * for high-performance production environments with minimal overhead.
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";
import { vision } from "@rodrigopsasaki/vision";
import {
  instrumentDataSource,
  visionTransaction,
  type VisionTypeOrmConfig,
} from "@rodrigopsasaki/vision-typeorm";

@Entity()
@Index("idx_user_email", ["email"])
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}

@Entity()
@Index("idx_product_category", ["category"])
@Index("idx_product_price", ["price"])
class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  category!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  price!: number;

  @Column({ default: true })
  inStock!: boolean;
}

// Performance-optimized configuration
const performanceConfig: VisionTypeOrmConfig = {
  enabled: true,

  // Minimize logging overhead
  logParams: false, // Disable parameter logging to reduce serialization cost
  logQuery: false, // Disable query logging to reduce string processing
  logResultCount: true, // Keep result count for business metrics

  // Optimize query truncation
  maxQueryLength: 200, // Shorter queries to reduce memory usage

  // Streamlined operation naming
  includeEntityInName: true,
  operationPrefix: "db", // Short prefix

  // Minimal security (assumes logs are already secured)
  redactFields: ["password"], // Only redact critical fields

  // Disable connection info logging (static information)
  logConnectionInfo: false,

  // Selective instrumentation for hot paths
  instrumentTransactions: true, // Keep transaction tracking
  instrumentRepositories: true,
  instrumentEntityManager: false, // Disable if not using entity manager directly
};

// Performance monitoring utilities
class PerformanceMonitor {
  private static thresholds = {
    queryDuration: 100, // ms
    transactionDuration: 500, // ms
    resultSetSize: 1000,
  };

  static setupPerformanceExporter() {
    vision.init({
      exporters: [
        {
          name: "performance-monitor",
          success: (ctx) => {
            const duration = ctx.data.get("database.duration_ms") as number;
            const resultCount = ctx.data.get("database.result_count") as number;
            const operation = ctx.data.get("database.operation") as string;

            // Alert on slow queries
            if (duration > this.thresholds.queryDuration) {
              console.warn(`Slow ${operation}: ${duration}ms`);
            }

            // Alert on large result sets
            if (resultCount > this.thresholds.resultSetSize) {
              console.warn(`Large result set for ${operation}: ${resultCount} rows`);
            }

            // Custom metrics collection (integrate with your metrics system)
            this.recordMetric(`db.${operation}.duration`, duration);
            if (resultCount !== undefined) {
              this.recordMetric(`db.${operation}.result_count`, resultCount);
            }
          },
          error: (ctx, err) => {
            const operation = ctx.data.get("database.operation") as string;
            console.error(`Database error in ${operation}:`, err);
            this.recordMetric(`db.${operation}.errors`, 1);
          },
        },
      ],
    });
  }

  private static recordMetric(name: string, value: number) {
    // Integrate with your metrics system (Prometheus, StatsD, etc.)
    // Example: metrics.histogram(name, value);
    console.log(`METRIC: ${name} = ${value}`);
  }
}

// Optimized service with selective instrumentation
class ProductService {
  constructor(private dataSource: DataSource) {}

  // High-frequency method: minimal instrumentation
  async findProductsByCategory(category: string, limit = 50): Promise<Product[]> {
    // Use selective Vision observability for business-critical operations only
    return vision.observe("product.search", async () => {
      vision.set("category", category);
      vision.set("limit", limit);

      const productRepository = this.dataSource.getRepository(Product);

      // Optimized query with proper indexing
      const products = await productRepository.find({
        where: { category, inStock: true },
        order: { price: "ASC" },
        take: limit,
      });

      vision.set("results_found", products.length);
      return products;
    });
  }

  // Batch operations: full instrumentation for monitoring
  async bulkUpdatePrices(categoryPriceMap: Record<string, number>): Promise<void> {
    return visionTransaction(
      this.dataSource,
      async (manager) => {
        const productRepository = manager.getRepository(Product);
        let totalUpdated = 0;

        for (const [category, priceMultiplier] of Object.entries(categoryPriceMap)) {
          // Use raw query for performance
          const result = await manager.query(
            `
          UPDATE product 
          SET price = price * $1 
          WHERE category = $2 AND inStock = true
        `,
            [priceMultiplier, category],
          );

          totalUpdated += result.affectedRows || 0;

          vision.push("updated_categories", category);
        }

        vision.set("total_products_updated", totalUpdated);
        vision.set("operation_type", "bulk_price_update");
      },
      performanceConfig,
    );
  }

  // Read-heavy operations: optimized for minimal overhead
  async getProductStats(): Promise<any> {
    const productRepository = this.dataSource.getRepository(Product);

    // Direct query without Vision overhead for internal stats
    const stats = await productRepository
      .createQueryBuilder("product")
      .select("category")
      .addSelect("COUNT(*)", "count")
      .addSelect("AVG(price)", "avgPrice")
      .addSelect("MIN(price)", "minPrice")
      .addSelect("MAX(price)", "maxPrice")
      .where("inStock = :inStock", { inStock: true })
      .groupBy("category")
      .getRawMany();

    return stats;
  }
}

async function performanceOptimizedExample() {
  // Setup performance monitoring
  PerformanceMonitor.setupPerformanceExporter();

  // Initialize DataSource with connection pooling
  const dataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "user",
    password: "password",
    database: "performance_test",
    entities: [User, Product],
    synchronize: false, // Disable in production

    // Connection pool optimization
    extra: {
      max: 20, // Maximum connections
      min: 5, // Minimum connections
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    },

    // Query optimization
    cache: {
      duration: 30000, // 30 second cache
    },
  });

  await dataSource.initialize();

  // Instrument with performance config
  const instrumentedDataSource = instrumentDataSource(dataSource, performanceConfig);
  const productService = new ProductService(instrumentedDataSource);

  // Example 1: High-frequency operations
  console.log("Testing high-frequency operations...");
  const startTime = Date.now();

  // Simulate concurrent requests
  const searchPromises = Array(10)
    .fill(0)
    .map(async (_, index) => {
      return productService.findProductsByCategory("electronics", 20);
    });

  const results = await Promise.all(searchPromises);
  const endTime = Date.now();

  console.log(`Completed ${searchPromises.length} concurrent searches in ${endTime - startTime}ms`);
  console.log(
    `Average results per search: ${results.reduce((sum, r) => sum + r.length, 0) / results.length}`,
  );

  // Example 2: Batch operations with monitoring
  console.log("Testing batch operations...");

  await productService.bulkUpdatePrices({
    electronics: 1.05, // 5% increase
    clothing: 0.95, // 5% decrease
    books: 1.02, // 2% increase
  });

  // Example 3: Analytics without instrumentation overhead
  console.log("Generating analytics...");

  const stats = await productService.getProductStats();
  console.log("Product statistics:", stats);

  // Example 4: Connection pool monitoring
  await vision.observe("system.health_check", async () => {
    const connection = instrumentedDataSource.manager.connection;

    // Check connection pool health
    if (connection.driver && "pool" in connection.driver) {
      const pool = (connection.driver as any).pool;
      if (pool) {
        vision.set("pool_total_connections", pool.totalCount);
        vision.set("pool_idle_connections", pool.idleCount);
        vision.set("pool_active_connections", pool.totalCount - pool.idleCount);
      }
    }

    // Sample query to verify connection
    const userCount = await instrumentedDataSource.getRepository(User).count();
    const productCount = await instrumentedDataSource.getRepository(Product).count();

    vision.set("total_users", userCount);
    vision.set("total_products", productCount);
    vision.set("health_status", "healthy");
  });

  await dataSource.destroy();
}

/**
 * Performance-optimized output focuses on key metrics:
 *
 * {
 *   "name": "product.search",
 *   "data": {
 *     "category": "electronics",
 *     "limit": 20,
 *     "results_found": 15,
 *     "database.success": true,
 *     "database.duration_ms": 12,
 *     "database.result_count": 15
 *   }
 * }
 *
 * Performance alerts:
 * METRIC: db.find.duration = 12
 * METRIC: db.find.result_count = 15
 */

if (require.main === module) {
  performanceOptimizedExample().catch(console.error);
}
