/**
 * Basic Vision TypeORM Integration Example
 * 
 * This example demonstrates the simplest way to add Vision observability
 * to your TypeORM application.
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { vision } from "@rodrigopsasaki/vision";
import { instrumentDataSource } from "@rodrigopsasaki/vision-typeorm";

// Define your entities as usual
@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;
}

@Entity()
class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  content!: string;

  @Column()
  userId!: number;
}

async function basicExample() {
  // 1. Create your DataSource as usual
  const dataSource = new DataSource({
    type: "sqlite",
    database: "example.db",
    entities: [User, Post],
    synchronize: true,
  });

  await dataSource.initialize();

  // 2. Instrument the DataSource with Vision (zero configuration!)
  const instrumentedDataSource = instrumentDataSource(dataSource);

  // 3. Use your repositories normally - Vision will automatically observe all operations
  await vision.observe("user.registration", async () => {
    const userRepository = instrumentedDataSource.getRepository(User);
    
    // This will be automatically observed as "db.user.save"
    const user = await userRepository.save({
      name: "John Doe",
      email: "john@example.com",
    });

    vision.set("user_id", user.id);
    vision.set("registration_method", "direct");

    // This will be automatically observed as "db.post.save"
    const postRepository = instrumentedDataSource.getRepository(Post);
    const post = await postRepository.save({
      title: "My First Post",
      content: "Hello, World!",
      userId: user.id,
    });

    vision.set("post_id", post.id);
    
    return { user, post };
  });

  await dataSource.destroy();
}

/**
 * Output will show structured events like:
 * 
 * {
 *   "name": "user.registration",
 *   "timestamp": "2025-01-15T10:30:00.000Z",
 *   "data": {
 *     "user_id": 1,
 *     "registration_method": "direct",
 *     "post_id": 1
 *   }
 * }
 * 
 * Plus individual database operations:
 * 
 * {
 *   "name": "db.user.save",
 *   "data": {
 *     "database.operation": "save",
 *     "database.target": "typeorm",
 *     "database.entity": "User",
 *     "database.success": true,
 *     "database.duration_ms": 15
 *   }
 * }
 */

if (require.main === module) {
  basicExample().catch(console.error);
}