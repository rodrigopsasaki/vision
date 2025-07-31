import { DataSource, Entity, PrimaryGeneratedColumn, Column, Repository } from "typeorm";

// Test entity for our tests
@Entity()
export class TestUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  password?: string;
}

@Entity()
export class TestPost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  content!: string;

  @Column()
  userId!: number;
}

// Create an in-memory SQLite database for testing
export function createTestDataSource(): DataSource {
  return new DataSource({
    type: "sqlite",
    database: ":memory:",
    entities: [TestUser, TestPost],
    synchronize: true,
    logging: false,
  });
}

// Mock vision context for testing
export class MockVisionContext {
  private data = new Map<string, unknown>();
  private observeCalls: Array<{ name: string; data: Map<string, unknown> }> = [];

  set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  get(key: string): unknown {
    return this.data.get(key);
  }

  push(key: string, value: unknown): void {
    const existing = this.data.get(key);
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing === undefined) {
      this.data.set(key, [value]);
    } else {
      this.data.set(key, [existing, value]);
    }
  }

  merge(key: string, value: Record<string, unknown>): void {
    const existing = this.data.get(key);
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      this.data.set(key, { ...existing, ...value });
    } else {
      this.data.set(key, value);
    }
  }

  observe(name: string, fn: () => Promise<unknown>): Promise<unknown> {
    const beforeData = new Map(this.data);
    
    return fn().then((result) => {
      this.observeCalls.push({
        name,
        data: new Map(this.data),
      });
      return result;
    });
  }

  context(): Map<string, unknown> {
    return new Map(this.data);
  }

  clear(): void {
    this.data.clear();
    this.observeCalls.length = 0;
  }

  getObserveCalls(): Array<{ name: string; data: Map<string, unknown> }> {
    return [...this.observeCalls];
  }

  getLastCall(): { name: string; data: Map<string, unknown> } | undefined {
    return this.observeCalls[this.observeCalls.length - 1];
  }
}