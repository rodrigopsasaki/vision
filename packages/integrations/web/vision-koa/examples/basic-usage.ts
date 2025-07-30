/**
 * Basic Vision Koa Integration Example
 * 
 * This example demonstrates the simplest way to integrate Vision with Koa:
 * - Middleware registration with default options
 * - Basic route handlers with Vision context access
 * - Automatic request/response tracking
 * - Koa's async/await pattern
 */

import Koa from 'koa';
import Router from '@koa/router';
import { createVisionMiddleware } from '@rodrigopsasaki/vision-koa';
import { vision } from '@rodrigopsasaki/vision';

const app = new Koa();
const router = new Router();

// Register the Vision middleware with default settings
app.use(createVisionMiddleware());

// Add error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Request error:', err);
    ctx.status = err.status || 500;
    ctx.body = {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    };
  }
});

// Basic route with Vision context
router.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  
  // Access the Vision context that was automatically created
  const visionContext = ctx.visionContext;
  console.log('Current context:', visionContext?.name);
  
  // Add custom data to the Vision context
  vision.set('user_id', id);
  vision.set('operation', 'get_user');
  
  // Simulate some business logic
  const user = await getUserById(id);
  
  if (!user) {
    vision.set('error', 'user_not_found');
    ctx.status = 404;
    ctx.body = { error: 'User not found' };
    return;
  }
  
  vision.set('user_found', true);
  ctx.body = user;
});

// Route with query parameters
router.get('/users', async (ctx) => {
  const { page = '1', limit = '10', search } = ctx.query;
  
  vision.set('operation', 'list_users');
  vision.set('page', parseInt(page as string));
  vision.set('limit', parseInt(limit as string));
  
  if (search) {
    vision.set('search_query', search);
  }
  
  // Simulate database query
  const users = await getUserList({
    page: parseInt(page as string),
    limit: parseInt(limit as string),
    search: search as string
  });
  
  vision.set('users_count', users.length);
  
  ctx.body = {
    users,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total: users.length
    }
  };
});

// POST route with request body
router.post('/users', async (ctx) => {
  const userData = ctx.request.body;
  
  vision.set('operation', 'create_user');
  vision.set('user_data_provided', !!userData);
  
  // Basic validation
  if (!userData || !userData.name || !userData.email) {
    vision.set('validation_error', 'missing_required_fields');
    ctx.status = 400;
    ctx.body = {
      error: 'Validation Error',
      message: 'Name and email are required'
    };
    return;
  }
  
  // Simulate user creation
  const newUser = await createUser(userData);
  
  vision.set('user_created', true);
  vision.set('new_user_id', newUser.id);
  
  ctx.status = 201;
  ctx.body = newUser;
});

// Route with custom middleware
router.get('/protected', authMiddleware, async (ctx) => {
  vision.set('operation', 'protected_access');
  vision.set('user_authenticated', true);
  
  ctx.body = {
    message: 'This is a protected route',
    user: ctx.state.user,
    timestamp: new Date().toISOString()
  };
});

// Health check route (excluded by default)
router.get('/health', async (ctx) => {
  ctx.body = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
});

// Route that demonstrates error handling
router.get('/error-demo', async (ctx) => {
  vision.set('demo_type', 'error_handling');
  vision.set('intentional_error', true);
  
  throw new Error('This is a demo error to show Vision error tracking');
});

// Route with async operations
router.get('/async-demo', async (ctx) => {
  vision.set('operation', 'async_demo');
  
  // Multiple async operations
  const [weather, news, stocks] = await Promise.all([
    fetchWeather(),
    fetchNews(),
    fetchStocks()
  ]);
  
  vision.set('async_operations_completed', 3);
  vision.set('weather_available', !!weather);
  vision.set('news_available', !!news);
  vision.set('stocks_available', !!stocks);
  
  ctx.body = {
    weather,
    news,
    stocks,
    timestamp: new Date().toISOString()
  };
});

// Register routes
app.use(router.routes());
app.use(router.allowedMethods());

// Simple authentication middleware
async function authMiddleware(ctx: Koa.Context, next: Koa.Next) {
  const authHeader = ctx.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { error: 'Authentication required' };
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  // Mock token validation
  if (token === 'valid-token') {
    ctx.state.user = {
      id: 'user_123',
      name: 'John Doe',
      email: 'john@example.com'
    };
    await next();
  } else {
    ctx.status = 401;
    ctx.body = { error: 'Invalid token' };
  }
}

// Mock service functions
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
    role: 'user',
    createdAt: new Date().toISOString()
  };
}

async function getUserList(options: { page: number; limit: number; search?: string }) {
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const allUsers = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
    { id: '3', name: 'Charlie Brown', email: 'charlie@example.com' },
    { id: '4', name: 'Diana Prince', email: 'diana@example.com' },
    { id: '5', name: 'Eve Wilson', email: 'eve@example.com' }
  ];
  
  let filteredUsers = allUsers;
  
  if (options.search) {
    filteredUsers = allUsers.filter(user => 
      user.name.toLowerCase().includes(options.search!.toLowerCase()) ||
      user.email.toLowerCase().includes(options.search!.toLowerCase())
    );
  }
  
  const startIndex = (options.page - 1) * options.limit;
  const endIndex = startIndex + options.limit;
  
  return filteredUsers.slice(startIndex, endIndex);
}

async function createUser(userData: any) {
  // Simulate user creation
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return {
    id: `user_${Date.now()}`,
    name: userData.name,
    email: userData.email,
    role: userData.role || 'user',
    createdAt: new Date().toISOString()
  };
}

async function fetchWeather() {
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    temperature: Math.round(Math.random() * 30 + 10),
    condition: 'sunny',
    humidity: Math.round(Math.random() * 100)
  };
}

async function fetchNews() {
  await new Promise(resolve => setTimeout(resolve, 250));
  return {
    headlines: [
      'Breaking: Important news update',
      'Technology: New framework released',
      'Weather: Sunny skies ahead'
    ],
    count: 3
  };
}

async function fetchStocks() {
  await new Promise(resolve => setTimeout(resolve, 180));
  return {
    symbols: {
      TECH: Math.round(Math.random() * 1000 + 100),
      FINANCE: Math.round(Math.random() * 500 + 50),
      ENERGY: Math.round(Math.random() * 200 + 25)
    }
  };
}

// Start the server
const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`🚀 Koa server with Vision is running on http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Try these endpoints:');
  console.log('  GET /users/123 - Get user (success)');
  console.log('  GET /users/404 - Get user (not found)');
  console.log('  GET /users?page=1&limit=3&search=alice - List users with search');
  console.log('  POST /users - Create user (send JSON: {"name": "Test", "email": "test@example.com"})');
  console.log('  GET /protected - Protected route (add header: Authorization: Bearer valid-token)');
  console.log('  GET /health - Health check (excluded from Vision)');
  console.log('  GET /error-demo - Error handling demo');
  console.log('  GET /async-demo - Multiple async operations demo');
  console.log('');
  console.log('📈 Watch the console for Vision context output!');
});