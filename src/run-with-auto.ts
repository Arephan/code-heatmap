import { initEnhancedAgent } from './enhanced-agent';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

const app = express();

// Initialize ENHANCED agent with auto-instrumentation
initEnhancedAgent({
  port: 9999,
  autoInstrument: true,
  baseDir: process.cwd(),
});

// Load and run the large sample app
declare global {
  function trackLine(file: string, line: number): void;
}

// Simple endpoints
app.get('/api/expensive', (req, res) => {
  global.trackLine('run-with-auto.ts', 23);
  const userId = String(req.query.id) || '1';
  for (let i = 0; i < 10; i++) {
    global.trackLine('run-with-auto.ts', 25);
    const result = processExpensive(userId, i);
  }
  global.trackLine('run-with-auto.ts', 28);
  res.json({ type: 'expensive' });
});

app.get('/api/medium', (req, res) => {
  global.trackLine('run-with-auto.ts', 33);
  const results = processMedium();
  global.trackLine('run-with-auto.ts', 34);
  res.json({ type: 'medium' });
});

app.get('/api/cheap', (req, res) => {
  global.trackLine('run-with-auto.ts', 39);
  res.json({ type: 'cheap' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Support functions
function processExpensive(userId: string, index: number) {
  global.trackLine('run-with-auto.ts', 49);
  const user = { id: userId, index };
  global.trackLine('run-with-auto.ts', 50);
  const enriched = enrichData(user);
  global.trackLine('run-with-auto.ts', 51);
  return analyze(enriched);
}

function processMedium() {
  global.trackLine('run-with-auto.ts', 56);
  const data = { items: 10 };
  global.trackLine('run-with-auto.ts', 57);
  return transform(data);
}

function enrichData(d: any) {
  global.trackLine('run-with-auto.ts', 62);
  return { ...d, enriched: true };
}

function analyze(d: any) {
  global.trackLine('run-with-auto.ts', 66);
  return { ...d, analyzed: true };
}

function transform(d: any) {
  global.trackLine('run-with-auto.ts', 70);
  return { ...d, transformed: true };
}

app.listen(3000, () => {
  console.log('📱 Test app with auto-instrumentation running on :3000');
});
