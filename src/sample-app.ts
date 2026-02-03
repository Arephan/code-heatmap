import express from 'express';
import { initHeatmapAgent } from './agent';

const app = express();

// Initialize heatmap agent (runs on port 9999)
initHeatmapAgent({
  port: 9999,
  dbPath: './heatmap.db',
});

// Sample endpoints with different execution frequencies

/**
 * Hot endpoint - called 100x
 * Processing user data, heavy computation
 */
app.get('/api/expensive', (req, res) => {
  const userId = req.query.id || '1';
  
  // Simulate expensive operation
  const userData = processUserData(userId as string);
  const enrichedData = enrichUserProfile(userData);
  const cached = cacheResult(enrichedData);
  
  res.json({ data: cached, endpoint: 'expensive' });
});

/**
 * Medium endpoint - called 10x
 * Some processing, moderate load
 */
app.get('/api/medium', (req, res) => {
  const filter = req.query.filter || 'all';
  
  const results = fetchResults(filter as string);
  const transformed = transformResults(results);
  
  res.json({ data: transformed, endpoint: 'medium' });
});

/**
 * Cold endpoint - called 1x
 * Minimal processing
 */
app.get('/api/cheap', (req, res) => {
  const simple = getSimpleData();
  res.json({ data: simple, endpoint: 'cheap' });
});

/**
 * Support functions (will show in heatmap)
 */
function processUserData(userId: string) {
  // Hot function - called 100 times
  const user = { id: userId, name: `User${userId}` };
  return user;
}

function enrichUserProfile(user: any) {
  // Hot function - called 100 times
  return {
    ...user,
    profile: { created: new Date(), verified: true },
  };
}

function cacheResult(data: any) {
  // Hot function - called 100 times
  return data; // In real app, would cache
}

function fetchResults(filter: string) {
  // Medium function - called 10 times
  return [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
}

function transformResults(results: any[]) {
  // Medium function - called 10 times
  return results.map((r) => ({ ...r, transformed: true }));
}

function getSimpleData() {
  // Cold function - called 1 time
  return { message: 'Hello' };
}

// Start app on port 3000
app.listen(3000, () => {
  console.log('📱 Sample app running on http://localhost:3000');
  console.log('   GET /api/expensive - hot endpoint (100 calls)');
  console.log('   GET /api/medium    - medium endpoint (10 calls)');
  console.log('   GET /api/cheap     - cold endpoint (1 call)');
  console.log('');
  console.log('🔥 Heatmap agent on http://localhost:9999');
  console.log('   GET /api/heatmap');
});
