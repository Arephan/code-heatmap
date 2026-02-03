import axios from 'axios';

const SAMPLE_APP_URL = 'http://localhost:3000';
const HEATMAP_API = 'http://localhost:9999';

async function runTest() {
  console.log('🧪 Starting heatmap test...\n');

  try {
    // Wait for apps to start
    console.log('⏳ Waiting for apps to be ready...');
    await new Promise((r) => setTimeout(r, 2000));

    // Reset heatmap
    console.log('🔄 Resetting heatmap...');
    await axios.post(`${HEATMAP_API}/api/heatmap/reset`);

    // Call expensive endpoint 100 times
    console.log('🔥 Calling /api/expensive 100 times...');
    for (let i = 0; i < 100; i++) {
      await axios.get(`${SAMPLE_APP_URL}/api/expensive?id=${i}`);
    }
    console.log('   ✓ 100 calls completed');

    // Call medium endpoint 10 times
    console.log('⚡ Calling /api/medium 10 times...');
    for (let i = 0; i < 10; i++) {
      await axios.get(`${SAMPLE_APP_URL}/api/medium?filter=test`);
    }
    console.log('   ✓ 10 calls completed');

    // Call cheap endpoint 1 time
    console.log('❄️  Calling /api/cheap 1 time...');
    await axios.get(`${SAMPLE_APP_URL}/api/cheap`);
    console.log('   ✓ 1 call completed');

    // Wait a bit for processing
    await new Promise((r) => setTimeout(r, 500));

    // Get heatmap
    console.log('\n📊 Querying heatmap...\n');
    const response = await axios.get(`${HEATMAP_API}/api/heatmap/stats`);
    const stats = response.data;

    console.log('=== HEATMAP STATS ===');
    console.log(`Total lines tracked: ${stats.totalLines}`);
    console.log(`Total executions: ${stats.totalExecutions}`);
    console.log('\n=== TOP 10 HOTTEST LINES ===');
    stats.hottest.forEach((item: any, idx: number) => {
      console.log(`${idx + 1}. ${item.key}: ${item.count} executions`);
    });

    console.log('\n=== FULL HEATMAP ===');
    console.log(JSON.stringify(stats.heatmap, null, 2));

    console.log('\n✅ Test completed successfully!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();
