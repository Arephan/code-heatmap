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
  console.log('🧪 Starting heatmap test...\n');

  try {
    // Wait for apps to start
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
        console.error(`   Error on iteration ${i}:`, (e as any).message);
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

    console.log('=== HEATMAP STATS ===');
    console.log(`Total lines tracked: ${stats.totalLines}`);
    console.log(`Total executions: ${stats.totalExecutions}`);

    console.log('\n=== TOP 10 HOTTEST LINES ===');
    stats.hottest.forEach((item: any, idx: number) => {
      const heat = item.count > 100 ? '🔥' : item.count > 10 ? '⚡' : '❄️';
      console.log(`${heat} ${idx + 1}. ${item.key}: ${item.count} executions`);
    });

    console.log('\n=== EXECUTION BREAKDOWN ===');
    Object.entries(stats.heatmap).forEach(([file, lines]: [string, any]) => {
      console.log(`\n${file}:`);
      Object.entries(lines)
        .sort(([_, a]: any, [__, b]: any) => b - a)
        .forEach(([line, count]: [string, any]) => {
          const heat = count > 100 ? '🔥' : count > 10 ? '⚡' : '❄️';
          console.log(`  ${heat} Line ${line}: ${count} executions`);
        });
    });

    console.log('\n✅ TEST PASSED! Heatmap is working correctly.');
    console.log('\nObservations:');
    console.log('- /api/expensive lines should be ~100 executions (🔥 hot)');
    console.log('- /api/medium lines should be ~10 executions (⚡ warm)');
    console.log('- /api/cheap lines should be ~1 execution (❄️ cold)');

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
