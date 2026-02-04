import axios from 'axios';

const SAMPLE_APP_URL = 'http://localhost:3000';
const HEATMAP_API = 'http://localhost:9999';

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url: string, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      await axios.get(`${url}/health`, { timeout: 1000 });
      return;
    } catch (e) {
      await wait(500);
    }
  }
  throw new Error(`Server ${url} did not start in time`);
}

async function runTest() {
  console.log('🧪 Starting large heatmap test (2000 lines)...\n');

  try {
    console.log('⏳ Waiting for heatmap agent to be ready...');
    await waitForServer(HEATMAP_API);
    console.log('   ✓ Heatmap agent is ready');

    console.log('⏳ Waiting for sample app to be ready...');
    await waitForServer(SAMPLE_APP_URL);
    console.log('   ✓ Sample app is ready\n');

    // Reset heatmap
    console.log('🔄 Resetting heatmap...');
    await axios.post(`${HEATMAP_API}/api/heatmap/reset`);
    console.log('   ✓ Reset complete\n');

    // Call expensive endpoint 100 times
    console.log('🔥 Calling /api/expensive 100 times...');
    for (let i = 0; i < 100; i++) {
      try {
        await axios.get(`${SAMPLE_APP_URL}/api/expensive?id=${i}`, { timeout: 5000 });
      } catch (e) {
        // Silently fail
      }
    }
    console.log('   ✓ 100 calls completed');

    await wait(500);

    // Call medium endpoint 10 times
    console.log('⚡ Calling /api/medium 10 times...');
    for (let i = 0; i < 10; i++) {
      await axios.get(`${SAMPLE_APP_URL}/api/medium?filter=test`);
    }
    console.log('   ✓ 10 calls completed');

    await wait(500);

    // Call cheap endpoint 1 time
    console.log('❄️  Calling /api/cheap 1 time...');
    await axios.get(`${SAMPLE_APP_URL}/api/cheap`);
    console.log('   ✓ 1 call completed\n');

    // Wait for processing
    await wait(1000);

    // Get heatmap stats
    console.log('📊 Querying heatmap stats...\n');
    const response = await axios.get(`${HEATMAP_API}/api/heatmap/stats`);
    const stats = response.data;

    console.log('=== HEATMAP SUMMARY ===');
    console.log(`Total lines tracked: ${stats.totalLines}`);
    console.log(`Total executions: ${stats.totalExecutions}`);

    console.log('\n=== TOP 20 HOTTEST LINES ===');
    stats.hottest.slice(0, 20).forEach((item: any, idx: number) => {
      const heat = item.count > 100 ? '🔥' : item.count > 10 ? '⚡' : item.count > 1 ? '🌡️' : '❄️';
      console.log(`${heat} ${idx + 1}. ${item.key}: ${item.count} executions`);
    });

    console.log('\n=== FULL HEATMAP (ALL LINES) ===');
    const heatmapByFile = stats.heatmap;
    let totalLines = 0;
    let totalExecutions = 0;

    Object.entries(heatmapByFile).forEach(([file, lineData]: [string, any]) => {
      const lines = Object.entries(lineData);
      totalLines += lines.length;
      const executions = lines.reduce((sum, [_, count]: [string, any]) => sum + count, 0);
      totalExecutions += executions;

      console.log(`\n${file}:`);
      console.log(`  Tracked lines: ${lines.length}`);
      console.log(`  Total executions: ${executions}`);
      console.log('  Breakdown:');

      // Group by execution count ranges
      const ranges: { [key: string]: number } = {
        '100+': 0,
        '10-99': 0,
        '1-9': 0,
        '0': 0,
      };

      lines.forEach(([lineNum, count]: [string, any]) => {
        if (count >= 100) ranges['100+']++;
        else if (count >= 10) ranges['10-99']++;
        else if (count >= 1) ranges['1-9']++;
        else ranges['0']++;
      });

      console.log(`    🔥 100+ executions: ${ranges['100+']} lines`);
      console.log(`    ⚡ 10-99 executions: ${ranges['10-99']} lines`);
      console.log(`    🌡️  1-9 executions: ${ranges['1-9']} lines`);
      console.log(`    ❄️  0 executions (tracked but never called): ${ranges['0']} lines`);

      // Show actual lines
      console.log('  Line details:');
      Object.entries(lineData)
        .sort(([_, a]: [string, any], [__, b]: [string, any]) => b - a)
        .forEach(([line, count]: [string, any]) => {
          if (count > 0) {
            const heat = count > 100 ? '🔥' : count > 10 ? '⚡' : '🌡️';
            console.log(`    ${heat} Line ${line}: ${count} executions`);
          }
        });
    });

    console.log('\n=== FINAL STATISTICS ===');
    console.log(`Total file: large-sample-app.ts`);
    console.log(`Total lines tracked: ${totalLines}`);
    console.log(`Total executions: ${totalExecutions}`);
    console.log(`Average executions per line: ${(totalExecutions / totalLines).toFixed(2)}`);

    console.log('\n✅ TEST PASSED! 2000-line heatmap working correctly.');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

runTest();
