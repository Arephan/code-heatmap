import express, { Express, Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';

interface HeatmapData {
  [file: string]: {
    [line: number]: number;
  };
}

let currentHeatmap: HeatmapData = {};
let db: Database.Database;
let lineExecutions: { [key: string]: number } = {};

export function initHeatmapAgent(options: {
  port?: number;
  dbPath?: string;
} = {}) {
  const port = options.port || 9999;
  const dbPath = options.dbPath || './heatmap.db';

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

  // Expose global tracking function
  (global as any).trackLine = (file: string, line: number) => {
    const key = `${file}:${line}`;
    lineExecutions[key] = (lineExecutions[key] || 0) + 1;
  };

  // Create Express server
  const app: Express = express();
  app.use(express.json());

  // API Endpoint: Get current heatmap
  app.get('/api/heatmap', (req: Request, res: Response) => {
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
  app.get('/api/heatmap/stats', (req: Request, res: Response) => {
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
  app.post('/api/heatmap/reset', (req: Request, res: Response) => {
    lineExecutions = {};
    currentHeatmap = {};
    res.json({ message: 'Heatmap reset' });
  });

  // API Endpoint: Health check
  app.get('/health', (req: Request, res: Response) => {
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
