const https = require('http');

https.get('http://localhost:8000/api/v1/docs-json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const swagger = JSON.parse(data);
    const paths = Object.keys(swagger.paths);
    const apiEndpoints = paths.filter(p => p.includes('/payment') || p.includes('/ads') || p.includes('/api-keys'));

    console.log('\n🔍 0xMart External API Endpoints (402 Payment Protocol):\n');
    console.log('='.repeat(80));

    apiEndpoints.forEach(path => {
      const methods = Object.keys(swagger.paths[path]);
      methods.forEach(method => {
        const endpoint = swagger.paths[path][method];
        const methodStr = method.toUpperCase().padEnd(7);
        const pathStr = path.padEnd(45);
        console.log(`${methodStr} ${pathStr} ${endpoint.summary || 'No description'}`);
      });
    });

    console.log('='.repeat(80));
    console.log(`\nTotal endpoints: ${apiEndpoints.length}`);
    console.log('\n✅ API is working!\n');
  });
}).on('error', (e) => {
  console.error('❌ Error:', e.message);
});
