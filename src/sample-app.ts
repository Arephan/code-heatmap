import express from 'express';
import { initHeatmapAgent } from './agent';

declare global {
  function trackLine(file: string, line: number): void;
}

const app = express();

// Initialize heatmap agent (runs on port 9999)
initHeatmapAgent({
  port: 9999,
  dbPath: './heatmap.db',
});

/**
 * Hot endpoint - will be called 100x
 */
app.get('/api/expensive', (req, res) => {
  global.trackLine('sample-app.ts', 18);
  const userId = req.query.id || '1';
  
  global.trackLine('sample-app.ts', 20);
  const userData = processUserData(userId as string);
  
  global.trackLine('sample-app.ts', 22);
  const enrichedData = enrichUserProfile(userData);
  
  global.trackLine('sample-app.ts', 24);
  const cached = cacheResult(enrichedData);
  
  global.trackLine('sample-app.ts', 26);
  res.json({ data: cached, endpoint: 'expensive' });
});

/**
 * Medium endpoint - will be called 10x
 */
app.get('/api/medium', (req, res) => {
  global.trackLine('sample-app.ts', 33);
  const filter = req.query.filter || 'all';
  
  global.trackLine('sample-app.ts', 35);
  const results = fetchResults(filter as string);
  
  global.trackLine('sample-app.ts', 37);
  const transformed = transformResults(results);
  
  global.trackLine('sample-app.ts', 39);
  res.json({ data: transformed, endpoint: 'medium' });
});

/**
 * Cold endpoint - will be called 1x
 */
app.get('/api/cheap', (req, res) => {
  global.trackLine('sample-app.ts', 46);
  const simple = getSimpleData();
  
  global.trackLine('sample-app.ts', 48);
  res.json({ data: simple, endpoint: 'cheap' });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Support functions
function processUserData(userId: string) {
  global.trackLine('sample-app.ts', 54);
  const user = { id: userId, name: `User${userId}` };
  return user;
}

function enrichUserProfile(user: any) {
  global.trackLine('sample-app.ts', 59);
  return {
    ...user,
    profile: { created: new Date(), verified: true },
  };
}

function cacheResult(data: any) {
  global.trackLine('sample-app.ts', 65);
  return data;
}

function fetchResults(filter: string) {
  global.trackLine('sample-app.ts', 69);
  return [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
}

function transformResults(results: any[]) {
  global.trackLine('sample-app.ts', 73);
  return results.map((r) => ({ ...r, transformed: true }));
}

function getSimpleData() {
  global.trackLine('sample-app.ts', 77);
  return { message: 'Hello' };
}

// Start app on port 3000
app.listen(3000, () => {
  console.log('📱 Sample app running on http://localhost:3000');
  console.log('   GET /api/expensive - hot endpoint (will be called 100x)');
  console.log('   GET /api/medium    - medium endpoint (will be called 10x)');
  console.log('   GET /api/cheap     - cold endpoint (will be called 1x)');
  console.log('');
  console.log('🔥 Heatmap agent on http://localhost:9999');
  console.log('   GET /api/heatmap');
  console.log('   GET /api/heatmap/stats');
});
