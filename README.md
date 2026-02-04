# Code Heatmap 🔥

Universal code execution heatmap tool. See which lines of code execute most frequently.

## Features

- 📊 **Track line-level execution counts** with minimal overhead
- 🔥 **Heatmap visualization** (hot → cold)
- 🚀 **Two tracking modes:**
  - **Manual**: Explicit `trackLine()` calls (most accurate)
  - **Automatic**: Source map + stack trace analysis (zero code changes)
- 🎯 Drop-in agent for production use
- 💾 SQLite persistence
- 🌐 REST API for querying
- 🔧 DWARF debug info mapping support

## Quick Start

### Run Sample App

```bash
# Install dependencies
npm install

# Start sample app (runs on port 3000 + heatmap agent on 9999)
npm run sample-app

# In another terminal, run test
npm run test
```

### What Happens

1. Sample app starts with 3 endpoints:
   - `/api/expensive` - will be called 100x (hot)
   - `/api/medium` - will be called 10x (warm)
   - `/api/cheap` - will be called 1x (cold)

2. Test script calls them at different frequencies

3. Heatmap agent tracks every line execution

4. Result shows which lines were called most:
   ```json
   {
     "src/sample-app.ts": {
       "15": 100,
       "22": 100,
       "25": 100,
       "42": 10,
       "50": 1
     }
   }
   ```

## API Endpoints

### Get Current Heatmap
```
GET http://localhost:9999/api/heatmap
```

Returns line-level execution counts.

### Get Heatmap Stats
```
GET http://localhost:9999/api/heatmap/stats
```

Returns stats including hottest lines.

### Reset Heatmap
```
POST http://localhost:9999/api/heatmap/reset
```

Clears all tracked data.

## Usage in Your App

```typescript
import { initHeatmapAgent } from './agent';

// Start heatmap agent (runs on separate port)
initHeatmapAgent({
  port: 9999,
  dbPath: './heatmap.db'
});

// Your app code here
app.listen(3000);
```

## How It Works

1. **Instrumentation**: Wraps each line with execution counter
2. **Collection**: Tracks line hits in-memory
3. **API**: Exposes data via REST endpoints
4. **Visualization**: Query to see which lines are hot

## Next Steps

- [ ] Add DWARF debug info mapping
- [ ] Support Python, Go, other languages
- [ ] React dashboard for multi-environment comparison
- [ ] Source map support
- [ ] Historical data analysis

## Built with

- TypeScript + Express
- better-sqlite3
- Babel AST manipulation

---

**Status**: MVP (works locally, Node.js support) ✅
