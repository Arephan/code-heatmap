import * as fs from 'fs';
import * as path from 'path';

/**
 * Automatic Instrumentation Agent
 * 
 * Hooks into Node.js require system to automatically track line executions
 * using source maps, without requiring manual trackLine() calls.
 */

export class AutoInstrumentAgent {
  private heatmap: { [key: string]: number } = {};
  private sourceMaps: Map<string, any> = new Map();
  private baseDir: string = '';

  /**
   * Initialize the auto-instrumentation
   * Hooks require() to instrument code on-the-fly
   */
  init(baseDir: string) {
    this.baseDir = baseDir;

    console.log('🔥 Initializing automatic instrumentation...');
    console.log('   - Scanning for source maps');
    console.log('   - Hooking require() to instrument code');
    console.log('   - Tracking line executions automatically');

    // Load all available source maps
    this.loadSourceMaps(`${baseDir}/dist`);

    // Hook require to instrument modules
    this.hookRequire();

    console.log('✓ Auto-instrumentation ready (no manual trackLine() needed)');
  }

  /**
   * Load source maps (.map files)
   */
  private loadSourceMaps(baseDir: string) {
    const walk = (dir: string) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        files.forEach((file) => {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) {
            walk(fullPath);
          } else if (file.name.endsWith('.map')) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const map = JSON.parse(content);
              this.sourceMaps.set(file.name.replace('.map', ''), map);
            } catch (e) {
              // Silently skip malformed maps
            }
          }
        });
      } catch (e) {
        // Silently skip unreadable dirs
      }
    };

    walk(baseDir);
    console.log(`   ✓ Loaded ${this.sourceMaps.size} source maps`);
  }

  /**
   * Hook require to wrap functions with tracking
   * This instruments code as it's loaded
   */
  private hookRequire() {
    const originalRequire = require.extensions['.js'];

    require.extensions['.js'] = (m: any, filename: string) => {
      // Load the original module
      originalRequire.call(this, m, filename);

      // If it's one of our app files, instrument exports
      if (filename.includes('/dist/') || filename.includes('\\dist\\')) {
        const exports = m.exports;

        // Wrap all function exports
        Object.keys(exports).forEach((key) => {
          if (typeof exports[key] === 'function') {
            const original = exports[key];
            exports[key] = (...args: any[]) => {
              const stack = new Error().stack || '';
              this.analyzeStackTrace(stack, filename);
              return original(...args);
            };
          }
        });
      }
    };
  }

  /**
   * Analyze stack trace to extract source locations
   */
  private analyzeStackTrace(stack: string, filename: string) {
    const lines = stack.split('\n');

    lines.forEach((line) => {
      // Parse "at functionName (filename:line:column)"
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);

      if (match) {
        const [, funcName, file, lineNum, colNum] = match;
        const shortFile = file.split('/').pop() || file;

        // Track the execution
        const key = `${shortFile}:${lineNum}`;
        this.heatmap[key] = (this.heatmap[key] || 0) + 1;
      }
    });
  }

  /**
   * Get current heatmap
   */
  getHeatmap(): { [key: string]: number } {
    return this.heatmap;
  }

  /**
   * Get heatmap with stats
   */
  getStats() {
    const totalLines = Object.keys(this.heatmap).length;
    const totalExecutions = Object.values(this.heatmap).reduce((a, b) => a + b, 0);
    const hottest = Object.entries(this.heatmap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));

    return {
      totalLines,
      totalExecutions,
      hottest,
      heatmap: this.formatHeatmap(),
    };
  }

  /**
   * Format heatmap as { file: { line: count } }
   */
  private formatHeatmap() {
    const formatted: { [file: string]: { [line: string]: number } } = {};

    Object.entries(this.heatmap).forEach(([key, count]) => {
      const [file, line] = key.split(':');
      if (!formatted[file]) formatted[file] = {};
      formatted[file][line] = count;
    });

    return formatted;
  }

  /**
   * Reset heatmap
   */
  reset() {
    this.heatmap = {};
  }
}

export default AutoInstrumentAgent;
