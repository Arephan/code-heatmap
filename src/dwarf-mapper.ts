import * as fs from 'fs';
import * as path from 'path';

/**
 * DWARF Debug Info Mapper
 * 
 * Reads compiled JavaScript/TypeScript and maps instruction pointers to source lines.
 * For Node.js, we'll use source maps + stack traces to identify which lines executed.
 */

interface LineMapping {
  file: string;
  line: number;
  column: number;
}

interface SourceMapEntry {
  generatedLine: number;
  generatedColumn: number;
  sourceLine: number;
  sourceColumn: number;
  sourceFile: string;
}

export class DWARFMapper {
  private sourceMaps: Map<string, SourceMapEntry[]> = new Map();

  /**
   * Load source maps from compiled files
   * Node.js generates source maps with TypeScript compilation
   */
  loadSourceMaps(baseDir: string) {
    const mapFiles = this.findSourceMapFiles(baseDir);
    
    mapFiles.forEach((mapFile) => {
      try {
        const content = fs.readFileSync(mapFile, 'utf8');
        const sourceMap = JSON.parse(content);
        
        if (sourceMap.mappings) {
          const entries = this.decodeMappings(sourceMap);
          this.sourceMaps.set(mapFile, entries);
        }
      } catch (e) {
        console.error(`Failed to load source map ${mapFile}:`, e);
      }
    });

    console.log(`✓ Loaded ${this.sourceMaps.size} source maps`);
  }

  /**
   * Find all .map files (source maps)
   */
  private findSourceMapFiles(baseDir: string): string[] {
    const files: string[] = [];

    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach((entry) => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.name.endsWith('.map')) {
            files.push(fullPath);
          }
        });
      } catch (e) {
        // Silently skip
      }
    };

    walk(baseDir);
    return files;
  }

  /**
   * Decode VLQ-encoded source map mappings
   * https://docs.google.com/document/d/1U1RGAehQwRyNSEVf2Xyk21UlSF0DwIZD1s0i3QTtbvI
   */
  private decodeMappings(sourceMap: any): SourceMapEntry[] {
    const entries: SourceMapEntry[] = [];
    const lines = sourceMap.mappings.split(';');
    
    let genLine = 1;
    let genCol = 0;
    let srcFile = 0;
    let srcLine = 0;
    let srcCol = 0;

    lines.forEach((line: string) => {
      genCol = 0;

      const segments = line.split(',');
      segments.forEach((seg: string) => {
        if (seg.length === 0) return;

        const vlq = this.decodeVLQ(seg);
        if (vlq.length === 0) return;

        genCol += vlq[0];
        if (vlq.length > 1) srcFile += vlq[1];
        if (vlq.length > 2) srcLine += vlq[2];
        if (vlq.length > 3) srcCol += vlq[3];

        if (srcFile < sourceMap.sources.length) {
          entries.push({
            generatedLine: genLine,
            generatedColumn: genCol,
            sourceLine: srcLine + 1,
            sourceColumn: srcCol,
            sourceFile: sourceMap.sources[srcFile],
          });
        }
      });

      genLine++;
    });

    return entries;
  }

  /**
   * Decode Variable-Length Quantity (VLQ)
   */
  private decodeVLQ(vlqStr: string): number[] {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const result: number[] = [];
    let value = 0;
    let shift = 0;

    for (let i = 0; i < vlqStr.length; i++) {
      const digit = chars.indexOf(vlqStr[i]);
      if (digit === -1) break;

      value += (digit & 31) << shift;
      if ((digit & 32) === 0) {
        result.push((value & 1) === 0 ? value >> 1 : -((value >> 1) + 1));
        value = 0;
        shift = 0;
      } else {
        shift += 5;
      }
    }

    return result;
  }

  /**
   * Map a generated line/column back to source line/column
   */
  mapToSource(generatedLine: number, generatedColumn: number): LineMapping | null {
    for (const [, entries] of this.sourceMaps) {
      const entry = entries.find(
        (e) => e.generatedLine === generatedLine && e.generatedColumn === generatedColumn
      );

      if (entry) {
        return {
          file: entry.sourceFile,
          line: entry.sourceLine,
          column: entry.sourceColumn,
        };
      }
    }

    return null;
  }
}

export default DWARFMapper;
