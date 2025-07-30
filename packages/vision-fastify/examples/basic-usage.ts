/**
 * Basic Vision Fastify Integration Example
 * 
 * This example demonstrates the simplest way to integrate Vision with Fastify:
 * - Plugin registration with default options
 * - Basic route handlers with Vision context access
 * - Automatic request/response tracking
 */

import Fastify from 'fastify';
import { visionPlugin } from '@rodrigopsasaki/vision-fastify';
import { vision } from '@rodrigopsasaki/vision';

const fastify = Fastify({
  logger: true
});

// Register the Vision plugin with default settings
await fastify.register(visionPlugin);

// Basic route with Vision context
fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  
  // Access the Vision context that was automatically created
  const ctx = request.visionContext;
  console.log('Current context:', ctx?.name);
  
  // Add custom data to the Vision context
  vision.set('user_id', id);
  vision.set('operation', 'get_user');
  
  // Simulate some business logic
  const user = await getUserById(id);
  
  if (!user) {
    vision.set('error', 'user_not_found');
    return reply.status(404).send({ error: 'User not found' });
  }
  
  vision.set('user_found', true);
  return user;
});

// Health check route (excluded by default)
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Route with error handling
fastify.get('/error-demo', async () => {
  vision.set('demo_type', 'error_handling');
  throw new Error('This is a demo error');
});

// Mock user service
async function getUserById(id: string) {
  // Simulate database lookup
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (id === '404') {
    return null;
  }
  
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    createdAt: new Date().toISOString()
  };
}

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Fastify server with Vision is running on http://localhost:3000');
    console.log('📊 Try these endpoints:');
    console.log('  GET /users/123 - Get user (success)');
    console.log('  GET /users/404 - Get user (not found)');
    console.log('  GET /health - Health check (excluded from Vision)');
    console.log('  GET /error-demo - Error handling demo');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();