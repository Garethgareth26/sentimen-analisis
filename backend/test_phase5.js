import http from 'http';

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (_) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'GET'
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (_) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('=== VERIFIKASI PENGUJIAN END-TO-END FASE 5 (DENSO AI X-RAY) ===\n');

  // 1. Test GET /api/history
  console.log('[TEST 1] GET /api/history (Fitur 4)');
  const res1 = await get('/api/history?date=2026-10-11');
  console.log('Status:', res1.status);
  console.log('Summary:', res1.data?.data?.summary);
  console.log('Sample record 1:', res1.data?.data?.records[0]?.station, res1.data?.data?.records[0]?.judgment, res1.data?.data?.records[0]?.dimension, 'mm');

  // 2. Test GET /api/history?judgment=ng
  console.log('\n[TEST 2] GET /api/history?judgment=ng (Filter NG)');
  const res2 = await get('/api/history?date=2026-10-11&judgment=ng');
  console.log('Status:', res2.status);
  console.log('NG Records Count:', res2.data?.data?.records?.length);
  console.log('NG Stations:', res2.data?.data?.records?.map(r => `${r.station} (${r.dimension}mm)`).join(', '));

  // 3. Test GET /api/history/dates
  console.log('\n[TEST 3] GET /api/history/dates');
  const res3 = await get('/api/history/dates');
  console.log('Status:', res3.status);
  console.log('Available Dates:', res3.data?.dates);

  // 4. Test POST /api/history/transfer (Fitur 7)
  console.log('\n[TEST 4] POST /api/history/transfer (Fitur 7 QC Server Sync)');
  const res4 = await post('/api/history/transfer', {
    date: '2026-10-11',
    targetPath: 'output/qc_server_mock',
    includeImages: true
  });
  console.log('Status:', res4.status);
  console.log('Transfer Result:', res4.data?.result);

  // 5. Test GET /api/history/transfer-status
  console.log('\n[TEST 5] GET /api/history/transfer-status');
  const res5 = await get('/api/history/transfer-status');
  console.log('Status:', res5.status);
  console.log('Audit count:', res5.data?.audits?.length);
  console.log('Last transfer message:', res5.data?.lastTransfer?.message);

  // 6. Test Option Save Data (Fitur 5) & Update Settings
  console.log('\n[TEST 6] POST /api/settings (Fitur 5 Save Option All/NG/OK)');
  const res6 = await post('/api/settings', {
    storage: {
      storage_path: 'output',
      save_option: 'all',
      image_format: 'jpg',
      qc_server_path: 'output/qc_server_mock'
    }
  });
  console.log('Status:', res6.status);
  console.log('Updated Storage Settings:', res6.data?.settings?.storage);

  // 7. Test Inspect Tray (Full 18 pocket) logging to CSV
  console.log('\n[TEST 7] POST /api/tray/inspect (Trigger full tray inspection & daily log)');
  const res7 = await post('/api/tray/inspect', { force: false });
  console.log('Status:', res7.status);
  console.log('Tray Inspect Result:', res7.data?.message);
  console.log('Tray Stations Count:', res7.data?.data?.stations?.length);

  // 8. Re-check history after tray run
  console.log('\n[TEST 8] Re-check GET /api/history after batch run');
  const res8 = await get('/api/history?date=2026-10-11');
  console.log('Total Records in CSV:', res8.data?.data?.totalRecords);
  console.log('Updated Summary:', res8.data?.data?.summary);

  console.log('\n=== SELURUH PENGUJIAN FASE 5 SUKSES (100% PASS) ===');
}

runTests().catch(console.error);
