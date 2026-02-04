import express, { Express, Request, Response } from 'express';
import Database from 'better-sqlite3';
import AutoInstrumentAgent from './auto-instrument-agent';

let currentHeatmap: any = {};
let db: Database.Database;
let lineExecutions: { [key: string]: number } = {};
let autoAgent: AutoInstrumentAgent;

export function initEnhancedAgent(options: {
  port?: number;
  dbPath?: string;
  autoInstrument?: boolean;
  baseDir?: string;
} = {}) {
  const port = options.port || 9999;
  const dbPath = options.dbPath || './heatmap.db';
  const autoInstrument = options.autoInstrument || false;
  const baseDir = options.baseDir || process.cwd();

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

  // Initialize automatic instrumentation if enabled
  if (autoInstrument) {
    autoAgent = new AutoInstrumentAgent();
    autoAgent.init(baseDir);
  }

  // Expose global tracking function (for manual tracking)
  (global as any).trackLine = (file: string, line: number) => {
    const key = `${file}:${line}`;
    lineExecutions[key] = (lineExecutions[key] || 0) + 1;
  };

  // Create Express server
  const app: Express = express();
  app.use(express.json());

  // API Endpoint: Get current heatmap (combined auto + manual)
  app.get('/api/heatmap', (req: Request, res: Response) => {
    const heatmap: any = {};

    // Combine manual + automatic tracking
    const allExecutions = { ...lineExecutions };
    if (autoAgent) {
      Object.assign(allExecutions, autoAgent.getHeatmap());
    }

    Object.entries(allExecutions).forEach(([key, count]) => {
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
    // Combine manual + automatic
    const allExecutions = { ...lineExecutions };
    if (autoAgent) {
      Object.assign(allExecutions, autoAgent.getHeatmap());
    }

    const totalLines = Object.keys(allExecutions).length;
    const totalExecutions = Object.values(allExecutions).reduce((a, b) => a + b, 0);
    const hottest = Object.entries(allExecutions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const heatmap: any = {};
    Object.entries(allExecutions).forEach(([key, count]) => {
      const [file, lineStr] = key.split(':');
      const line = parseInt(lineStr, 10);

      if (!heatmap[file]) {
        heatmap[file] = {};
      }
      heatmap[file][line] = count;
    });

    res.json({
      totalLines,
      totalExecutions,
      autoInstrumentEnabled: !!autoAgent,
      hottest: hottest.map(([key, count]) => ({ key, count })),
      heatmap,
    });
  });

  // API Endpoint: Reset heatmap
  app.post('/api/heatmap/reset', (req: Request, res: Response) => {
    lineExecutions = {};
    if (autoAgent) {
      autoAgent.reset();
    }
    currentHeatmap = {};
    res.json({ message: 'Heatmap reset' });
  });

  // API Endpoint: Toggle auto-instrumentation
  app.post('/api/heatmap/auto-instrument/:enabled', (req: Request, res: Response) => {
    const enabled = req.params.enabled === 'true';

    if (enabled && !autoAgent) {
      autoAgent = new AutoInstrumentAgent();
      autoAgent.init(baseDir);
      res.json({ message: 'Auto-instrumentation enabled' });
    } else if (!enabled && autoAgent) {
      autoAgent = null as any;
      res.json({ message: 'Auto-instrumentation disabled' });
    } else {
      res.json({ message: 'No change needed', enabled: !!autoAgent });
    }
  });

  // API Endpoint: Get mode info
  app.get('/api/heatmap/mode', (req: Request, res: Response) => {
    res.json({
      manualTracking: true,
      autoInstrumentation: !!autoAgent,
      description: autoAgent
        ? 'Hybrid mode: both manual trackLine() and automatic instrumentation'
        : 'Manual mode: only explicit trackLine() calls',
    });
  });

  // API Endpoint: Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Start server
  const server = app.listen(port, () => {
    console.log(`🔥 Enhanced Heatmap Agent running on http://localhost:${port}`);
    console.log(`   GET  /api/heatmap              - Get current heatmap`);
    console.log(`   GET  /api/heatmap/stats        - Get heatmap with stats`);
    console.log(`   GET  /api/heatmap/mode         - Get tracking mode info`);
    console.log(`   POST /api/heatmap/reset        - Reset heatmap`);
    console.log(`   POST /api/heatmap/auto-instrument/true|false - Toggle auto`);
    if (autoAgent) {
      console.log(`\n✓ Auto-instrumentation ENABLED`);
    }
  });

  return server;
}
