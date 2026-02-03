import express, { Express } from 'express';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

interface HeatmapSample {
  file: string;
  line: number;
  count: number;
}

interface HeatmapData {
  [file: string]: {
    [line: number]: number;
  };
}

let currentHeatmap: HeatmapData = {};
let db: Database.Database;

export function initHeatmapAgent(options: {
  port?: number;
  dbPath?: string;
  samplingInterval?: number;
} = {}) {
  const port = options.port || 9999;
  const dbPath = options.dbPath || './heatmap.db';
  const samplingInterval = options.samplingInterval || 1000; // ms

  // Initialize database
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS heatmap_samples (
      id INTEGER PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      file TEXT NOT NULL,
      line INTEGER NOT NULL,
      count INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_timestamp ON heatmap_samples(timestamp);
    CREATE INDEX IF NOT EXISTS idx_file_line ON heatmap_samples(file, line);
  `);

  // Create Express server
  const app: Express = express();

  // Middleware
  app.use(express.json());

  // Track line executions (simple in-memory sampling)
  const lineExecutions: { [key: string]: number } = {};

  // Intercept require to track line executions
  const originalRequire = require.extensions['.js'];
  require.extensions['.js'] = function (m: any, filename: string) {
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n');

    // Wrap with instrumentation
    let instrumented = content;
    lines.forEach((line, idx) => {
      if (line.trim() && !line.trim().startsWith('//')) {
        const lineNum = idx + 1;
        const key = `${filename}:${lineNum}`;
        instrumented = instrumented.replace(
          line,
          `(function() { lineExecutions['${key}'] = (lineExecutions['${key}'] || 0) + 1; })(); ${line}`
        );
      }
    });

    return originalRequire.call(this, m, filename);
  };

  // Expose lineExecutions to global scope (for instrumented code to access)
  (global as any).lineExecutions = lineExecutions;

  // API Endpoint: Get current heatmap
  app.get('/api/heatmap', (req, res) => {
    const heatmap: HeatmapData = {};

    Object.entries(lineExecutions).forEach(([key, count]) => {
      const [file, lineStr] = key.split(':');
      const line = parseInt(lineStr, 10);

      if (!heatmap[file]) {
        heatmap[file] = {};
      }
      heatmap[file][line] = count;
    });

    currentHeatmap = heatmap;
    res.json(heatmap);
  });

  // API Endpoint: Get heatmap with stats
  app.get('/api/heatmap/stats', (req, res) => {
    const totalLines = Object.keys(lineExecutions).length;
    const totalExecutions = Object.values(lineExecutions).reduce((a, b) => a + b, 0);
    const hottest = Object.entries(lineExecutions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    res.json({
      totalLines,
      totalExecutions,
      hottest: hottest.map(([key, count]) => ({ key, count })),
      heatmap: currentHeatmap,
    });
  });

  // API Endpoint: Reset heatmap
  app.post('/api/heatmap/reset', (req, res) => {
    Object.keys(lineExecutions).forEach((key) => {
      delete lineExecutions[key];
    });
    currentHeatmap = {};
    res.json({ message: 'Heatmap reset' });
  });

  // API Endpoint: Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Start server
  const server = app.listen(port, () => {
    console.log(`🔥 Heatmap agent running on http://localhost:${port}`);
    console.log(`   GET  /api/heatmap       - Get current heatmap`);
    console.log(`   GET  /api/heatmap/stats - Get heatmap with stats`);
    console.log(`   POST /api/heatmap/reset - Reset heatmap`);
  });

  return server;
}
