import axios from 'axios';

const HEATMAP_API = 'http://localhost:9999';
const APP_URL = 'http://localhost:3000';

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url: string) {
  for (let i = 0; i < 30; i++) {
    try {
      await axios.get(`${url}/health`);
      return;
    } catch (e) {
      await wait(500);
    }
  }
  throw new Error(`Server ${url} not responding`);
}

async function runTest() {
  console.log('🧪 Testing auto-instrumentation on large sample app...\n');

  try {
    // Wait for servers
    console.log('⏳ Waiting for heatmap agent...');
    await waitForServer(HEATMAP_API);
    console.log('✓ Heatmap agent ready');

    console.log('⏳ Waiting for sample app...');
    await waitForServer(APP_URL);
    console.log('✓ Sample app ready\n');

    // Reset heatmap
    console.log('🔄 Resetting heatmap...');
    await axios.post(`${HEATMAP_API}/api/heatmap/reset`);

    // Generate traffic (using existing large-sample-app endpoints)
    console.log('📊 Generating execution data...\n');

    console.log('   🔥 Calling /api/expensive 100 times');
    for (let i = 0; i < 100; i++) {
      await axios.get(`${APP_URL}/api/expensive?id=${i}`);
    }

    console.log('   ⚡ Calling /api/medium 30 times');
    for (let i = 0; i < 30; i++) {
      await axios.get(`${APP_URL}/api/medium?filter=test`);
    }

    console.log('   ❄️  Calling /api/cheap 10 times');
    for (let i = 0; i < 10; i++) {
      await axios.get(`${APP_URL}/api/cheap`);
    }

    console.log('\n✓ Traffic generated\n');

    // Wait for processing
    await wait(2000);

    // Get heatmap
    console.log('📊 Querying heatmap stats...\n');
    const response = await axios.get(`${HEATMAP_API}/api/heatmap/stats`);
    const stats = response.data;

    // Print summary
    console.log('=== HEATMAP SUMMARY ===');
    console.log(`Total lines tracked: ${stats.totalLines}`);
    console.log(`Total executions: ${stats.totalExecutions}`);
    console.log(`Auto-instrumentation: ${stats.autoInstrumentEnabled ? '✓ ENABLED' : '✗ DISABLED'}`);

    if (stats.totalLines > 0) {
      console.log(`Average executions per line: ${(stats.totalExecutions / stats.totalLines).toFixed(2)}`);
    }

    // Flatten all lines
    const allLines: any[] = [];
    Object.entries(stats.heatmap).forEach(([file, lineData]: [string, any]) => {
      Object.entries(lineData).forEach(([line, count]: [string, any]) => {
        allLines.push({
          key: `${file}:${line}`,
          count,
        });
      });
    });

    // Sort by count
    allLines.sort((a, b) => b.count - a.count);

    // Show top 100
    console.log('\n=== TOP 100 HOTTEST LINES ===\n');

    const topCount = Math.min(100, allLines.length);
    allLines.slice(0, topCount).forEach((item, idx) => {
      const heat =
        item.count > 100
          ? '🔥'
          : item.count > 50
            ? '⚡'
            : item.count > 10
              ? '🌡️'
              : item.count > 1
                ? '🔶'
                : '❄️';

      const paddedIdx = (idx + 1).toString().padStart(3, ' ');
      const paddedKey = item.key.padEnd(45, ' ');
      const paddedCount = item.count.toString().padStart(6, ' ');

      console.log(`${heat} ${paddedIdx}. ${paddedKey} ${paddedCount} executions`);
    });

    console.log(`\n✅ Showing ${topCount} of ${allLines.length} total tracked lines`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTest();
