/**
 * Microservice Vision TypeORM Integration Example
 * 
 * This example demonstrates how to use Vision TypeORM integration in a
 * microservice architecture with distributed tracing and correlation IDs.
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { vision } from "@rodrigopsasaki/vision";
import { 
  instrumentDataSource,
  visionTransaction,
  type VisionTypeOrmConfig 
} from "@rodrigopsasaki/vision-typeorm";

// Domain entities for different microservices
@Entity()
class Customer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity()
class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  customerId!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  totalAmount!: number;

  @Column()
  status!: string;

  @Column("json", { nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity()
class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  orderId!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  amount!: number;

  @Column()
  method!: string;

  @Column()
  status!: string;

  @Column()
  externalTransactionId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

// Microservice-specific configuration
const microserviceConfig: VisionTypeOrmConfig = {
  enabled: true,
  logParams: true,
  logQuery: true,
  logResultCount: true,
  maxQueryLength: 500,
  includeEntityInName: true,
  operationPrefix: "db",
  redactFields: ["password", "token", "secret", "creditCard", "ssn"],
  logConnectionInfo: true,
  instrumentTransactions: true,
  instrumentRepositories: true,
  instrumentEntityManager: true,
};

// Correlation ID middleware for distributed tracing
class CorrelationContext {
  private static currentId: string | null = null;

  static setCorrelationId(id: string) {
    this.currentId = id;
  }

  static getCorrelationId(): string {
    return this.currentId || this.generateId();
  }

  static generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static withCorrelationId<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previousId = this.currentId;
    this.currentId = id;
    
    return fn().finally(() => {
      this.currentId = previousId;
    });
  }
}

// Customer Service
class CustomerService {
  constructor(private dataSource: DataSource) {}

  async createCustomer(customerData: Partial<Customer>): Promise<Customer> {
    const correlationId = CorrelationContext.getCorrelationId();
    
    return vision.observe("customer.create", async () => {
      vision.set("correlation_id", correlationId);
      vision.set("service", "customer-service");
      vision.set("operation_type", "create");

      const customerRepository = this.dataSource.getRepository(Customer);
      
      const customer = await customerRepository.save({
        ...customerData,
        status: "active",
      });

      vision.set("customer_id", customer.id);
      vision.set("customer_email", customer.email);
      vision.set("entity_created", true);

      return customer;
    });
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    const correlationId = CorrelationContext.getCorrelationId();
    
    return vision.observe("customer.get", async () => {
      vision.set("correlation_id", correlationId);
      vision.set("service", "customer-service");
      vision.set("customer_id", customerId);

      const customerRepository = this.dataSource.getRepository(Customer);
      const customer = await customerRepository.findOne({ where: { id: customerId } });

      vision.set("customer_found", !!customer);
      if (customer) {
        vision.set("customer_status", customer.status);
      }

      return customer;
    });
  }

  async updateCustomerStatus(customerId: string, status: string): Promise<void> {
    const correlationId = CorrelationContext.getCorrelationId();
    
    return vision.observe("customer.update_status", async () => {
      vision.set("correlation_id", correlationId);
      vision.set("service", "customer-service");
      vision.set("customer_id", customerId);
      vision.set("new_status", status);

      const customerRepository = this.dataSource.getRepository(Customer);
      
      const result = await customerRepository.update(customerId, { 
        status,
        updatedAt: new Date(),
      });

      vision.set("rows_affected", result.affected || 0);
      vision.set("update_successful", (result.affected || 0) > 0);
    });
  }
}

// Order Service
class OrderService {
  constructor(private dataSource: DataSource) {}

  async createOrder(orderData: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
  }): Promise<Order> {
    const correlationId = CorrelationContext.getCorrelationId();
    
    return visionTransaction(this.dataSource, async (manager) => {
      vision.set("correlation_id", correlationId);
      vision.set("service", "order-service");
      vision.set("operation_type", "create_order");
      vision.set("customer_id", orderData.customerId);

      const orderRepository = manager.getRepository(Order);
      
      // Calculate total amount
      const totalAmount = orderData.items.reduce((sum, item) => 
        sum + (item.quantity * item.price), 0
      );

      const order = await orderRepository.save({
        customerId: orderData.customerId,
        totalAmount,
        status: "pending",
        metadata: {
          items: orderData.items,
          itemCount: orderData.items.length,
          correlationId,
        },
      });

      vision.set("order_id", order.id);
      vision.set("total_amount", totalAmount);
      vision.set("item_count", orderData.items.length);
      vision.set("order_status", "pending");

      return order;
    }, microserviceConfig);
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const correlationId = CorrelationContext.getCorrelationId();
    
    return vision.observe("order.update_status", async () => {
      vision.set("correlation_id", correlationId);
      vision.set("service", "order-service");
      vision.set("order_id", orderId);
      vision.set("new_status", status);

      const orderRepository = this.dataSource.getRepository(Order);
      
      const result = await orderRepository.update(orderId, { 
        status,
        updatedAt: new Date(),
      });

      vision.set("update_successful", (result.affected || 0) > 0);
    });
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    const correlationId = CorrelationContext.getCorrelationId();
    
    return vision.observe("order.get_by_customer", async () => {
      vision.set("correlation_id", correlationId);
      vision.set("service", "order-service");
      vision.set("customer_id", customerId);

      const orderRepository = this.dataSource.getRepository(Order);
      
      const orders = await orderRepository.find({
        where: { customerId },
        order: { createdAt: "DESC" },
      });

      vision.set("order_count", orders.length);
      if (orders.length > 0) {
        vision.set("latest_order_status", orders[0].status);
        vision.set("total_order_value", orders.reduce((sum, o) => sum + Number(o.totalAmount), 0));
      }

      return orders;
    });
  }
}

// Payment Service
class PaymentService {
  constructor(private dataSource: DataSource) {}

  async processPayment(paymentData: {
    orderId: string;
    amount: number;
    method: string;
  }): Promise<Payment> {
    const correlationId = CorrelationContext.getCorrelationId();
    
    return visionTransaction(this.dataSource, async (manager) => {
      vision.set("correlation_id", correlationId);
      vision.set("service", "payment-service");
      vision.set("operation_type", "process_payment");
      vision.set("order_id", paymentData.orderId);
      vision.set("payment_method", paymentData.method);
      vision.set("payment_amount", paymentData.amount);

      const paymentRepository = manager.getRepository(Payment);
      
      // Simulate external payment processing
      const externalTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      
      try {
        // Simulate payment gateway call
        await this.simulatePaymentGateway(paymentData, externalTransactionId);
        
        const payment = await paymentRepository.save({
          orderId: paymentData.orderId,
          amount: paymentData.amount,
          method: paymentData.method,
          status: "completed",
          externalTransactionId,
        });

        vision.set("payment_id", payment.id);
        vision.set("external_transaction_id", externalTransactionId);
        vision.set("payment_status", "completed");
        vision.set("payment_successful", true);

        return payment;
      } catch (error) {
        // Record failed payment
        const payment = await paymentRepository.save({
          orderId: paymentData.orderId,
          amount: paymentData.amount,
          method: paymentData.method,
          status: "failed",
          externalTransactionId,
        });

        vision.set("payment_id", payment.id);
        vision.set("external_transaction_id", externalTransactionId);
        vision.set("payment_status", "failed");
        vision.set("payment_successful", false);
        vision.set("failure_reason", error instanceof Error ? error.message : "unknown");

        throw error;
      }
    }, microserviceConfig);
  }

  private async simulatePaymentGateway(paymentData: any, transactionId: string): Promise<void> {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Simulate occasional failures
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error("Payment gateway timeout");
    }
  }
}

// Orchestrator for distributed transaction
class OrderOrchestrator {
  constructor(
    private customerService: CustomerService,
    private orderService: OrderService,
    private paymentService: PaymentService
  ) {}

  async processOrderWorkflow(orderRequest: {
    customerEmail: string;
    customerName: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    paymentMethod: string;
  }): Promise<{ orderId: string; paymentId: string }> {
    const correlationId = CorrelationContext.generateId();
    
    return CorrelationContext.withCorrelationId(correlationId, async () => {
      return vision.observe("workflow.process_order", async () => {
        vision.set("correlation_id", correlationId);
        vision.set("service", "order-orchestrator");
        vision.set("workflow_type", "complete_order");
        vision.set("customer_email", orderRequest.customerEmail);

        try {
          // Step 1: Create or get customer
          let customer = await this.customerService.getCustomer(orderRequest.customerEmail);
          if (!customer) {
            customer = await this.customerService.createCustomer({
              name: orderRequest.customerName,
              email: orderRequest.customerEmail,
            });
            vision.set("customer_created", true);
          } else {
            vision.set("customer_created", false);
          }

          // Step 2: Create order
          const order = await this.orderService.createOrder({
            customerId: customer.id,
            items: orderRequest.items,
          });

          // Step 3: Process payment
          const payment = await this.paymentService.processPayment({
            orderId: order.id,
            amount: Number(order.totalAmount),
            method: orderRequest.paymentMethod,
          });

          // Step 4: Update order status
          await this.orderService.updateOrderStatus(order.id, "paid");

          // Step 5: Update customer status if first order
          const customerOrders = await this.orderService.getOrdersByCustomer(customer.id);
          if (customerOrders.length === 1) {
            await this.customerService.updateCustomerStatus(customer.id, "verified");
            vision.set("customer_verified", true);
          }

          vision.set("workflow_status", "completed");
          vision.set("order_id", order.id);
          vision.set("payment_id", payment.id);
          vision.set("final_order_status", "paid");

          return {
            orderId: order.id,
            paymentId: payment.id,
          };

        } catch (error) {
          vision.set("workflow_status", "failed");
          vision.set("error_message", error instanceof Error ? error.message : "unknown");
          throw error;
        }
      });
    });
  }
}

async function microserviceExample() {
  // Initialize separate databases for each service (in real world, these would be separate DBs)
  const customerDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "user",
    password: "password",
    database: "customer_service",
    entities: [Customer],
    synchronize: true,
  });

  const orderDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "user",
    password: "password",
    database: "order_service",
    entities: [Order],
    synchronize: true,
  });

  const paymentDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "user",
    password: "password",
    database: "payment_service",
    entities: [Payment],
    synchronize: true,
  });

  await Promise.all([
    customerDataSource.initialize(),
    orderDataSource.initialize(),
    paymentDataSource.initialize(),
  ]);

  // Instrument all data sources
  const instrumentedCustomerDS = instrumentDataSource(customerDataSource, microserviceConfig);
  const instrumentedOrderDS = instrumentDataSource(orderDataSource, microserviceConfig);
  const instrumentedPaymentDS = instrumentDataSource(paymentDataSource, microserviceConfig);

  // Initialize services
  const customerService = new CustomerService(instrumentedCustomerDS);
  const orderService = new OrderService(instrumentedOrderDS);
  const paymentService = new PaymentService(instrumentedPaymentDS);
  const orchestrator = new OrderOrchestrator(customerService, orderService, paymentService);

  // Setup distributed tracing exporter
  vision.init({
    exporters: [
      {
        name: "microservice-tracer",
        success: (ctx) => {
          const correlationId = ctx.data.get("correlation_id");
          const service = ctx.data.get("service");
          const operation = ctx.data.get("database.operation") || ctx.name;
          
          console.log(`[${correlationId}] ${service}: ${operation} completed successfully`);
        },
        error: (ctx, err) => {
          const correlationId = ctx.data.get("correlation_id");
          const service = ctx.data.get("service");
          const operation = ctx.data.get("database.operation") || ctx.name;
          
          console.error(`[${correlationId}] ${service}: ${operation} failed:`, err);
        }
      }
    ]
  });

  // Process complete order workflow
  try {
    const result = await orchestrator.processOrderWorkflow({
      customerEmail: "alice@example.com",
      customerName: "Alice Johnson",
      items: [
        { productId: "prod_1", quantity: 2, price: 29.99 },
        { productId: "prod_2", quantity: 1, price: 15.50 },
      ],
      paymentMethod: "credit_card",
    });

    console.log("Order workflow completed:", result);
  } catch (error) {
    console.error("Order workflow failed:", error);
  }

  // Cleanup
  await Promise.all([
    customerDataSource.destroy(),
    orderDataSource.destroy(),
    paymentDataSource.destroy(),
  ]);
}

/**
 * Microservice output with correlation tracking:
 * 
 * [req_1642234567890_abc123def] customer-service: customer.create completed successfully
 * [req_1642234567890_abc123def] order-service: db.transaction completed successfully
 * [req_1642234567890_abc123def] payment-service: db.transaction completed successfully
 * [req_1642234567890_abc123def] order-orchestrator: workflow.process_order completed successfully
 * 
 * Structured event with full context:
 * {
 *   "name": "workflow.process_order",
 *   "data": {
 *     "correlation_id": "req_1642234567890_abc123def",
 *     "service": "order-orchestrator",
 *     "workflow_type": "complete_order",
 *     "customer_email": "alice@example.com",
 *     "customer_created": true,
 *     "customer_verified": true,
 *     "workflow_status": "completed",
 *     "order_id": "uuid-order-id",
 *     "payment_id": "uuid-payment-id",
 *     "final_order_status": "paid"
 *   }
 * }
 */

if (require.main === module) {
  microserviceExample().catch(console.error);
}