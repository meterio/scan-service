const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const deps = require('../package.json').dependencies;
const axios = require('axios');

// Tests must never contact production services, databases, RPCs, or webhooks.
for (const protocol of [http, require('node:https')]) {
  const request = protocol.request;
  protocol.request = function (...args) {
    const options = args[0];
    const host = typeof options === 'string' ? new URL(options).hostname
      : options instanceof URL ? options.hostname : options.hostname || options.host || 'localhost';
    assert.ok(['127.0.0.1', 'localhost', '::1'].includes(host), 'external network request blocked');
    return request.apply(this, args);
  };
}

async function fixture(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => {
    server.closeAllConnections(); server.close(resolve);
  }) };
}

test('actual App keeps JSON, gzip, forms, cookies and parser rejection behavior', async () => {
  const db = require.resolve('../dist/src/utils/db');
  const previous = require.cache[db];
  require.cache[db] = { id: db, filename: db, loaded: true, exports: {
    connectDB: () => { throw new Error('database access blocked'); },
  } };
  let App;
  try { App = require('../dist/src/api/app').default; }
  finally { if (previous) require.cache[db] = previous; else delete require.cache[db]; }
  const express = require('express');
  const router = express.Router();
  router.post('/fixture', (req, res) => res.json({ body: req.body, cookies: req.cookies }));
  const app = new App([{ router }], 0, false).getServer();
  const f = await fixture(app);
  const post = (data, headers = {}) => axios.post(f.base + '/fixture', data, {
    headers, timeout: 2000, proxy: false, validateStatus: () => true,
  });
  try {
    const normal = await post({ name: 'Alice' }, { Cookie: 'session=fixture' });
    assert.equal(normal.status, 200);
    assert.deepEqual(normal.data, { body: { name: 'Alice' }, cookies: { session: 'fixture' } });
    const compressed = await post(zlib.gzipSync(Buffer.from('{"name":"Alice"}')), {
      'Content-Type': 'application/json', 'Content-Encoding': 'gzip',
    });
    assert.equal(compressed.status, 200); assert.equal(compressed.data.body.name, 'Alice');
    const form = await post('name=Alice&tag=one&tag=two', { 'Content-Type': 'application/x-www-form-urlencoded' });
    assert.equal(form.status, 200); assert.deepEqual(form.data.body, { name: 'Alice', tag: ['one', 'two'] });
    assert.equal((await post('{', { 'Content-Type': 'application/json' })).status, 400);
    assert.equal((await post({ payload: 'x'.repeat(110 * 1024) })).status, 413);
    assert.equal((await post(Array.from({ length: 1001 }, (_, i) => 'k' + i + '=v').join('&'), {
      'Content-Type': 'application/x-www-form-urlencoded',
    })).status, 413);
    const hostile = await post('{"__proto__":{"dependencyPollution":true}}', { 'Content-Type': 'application/json' });
    assert.equal(hostile.status, 200); assert.equal({}.dependencyPollution, undefined);
  } finally { await f.close(); }
});

test('Axios HTTP adapter preserves GraphQL/form posts, redirects and compressed responses', async () => {
  const f = await fixture(async (req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/br' }); return res.end(); }
    if (req.url === '/bad-br') { res.writeHead(200, { 'Content-Encoding': 'br' }); return res.end(Buffer.from([255, 255, 255])); }
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.stringify({ method: req.method, body, marker: req.headers['x-fixture'], ok: true });
    const brotli = req.url === '/br';
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': brotli ? 'br' : 'gzip' });
    res.end(brotli ? zlib.brotliCompressSync(Buffer.from(data)) : zlib.gzipSync(Buffer.from(data)));
  });
  const options = { proxy: false, timeout: 2000 };
  try {
    const get = await axios.get(f.base + '/redirect', options);
    assert.equal(get.data.ok, true); assert.equal(get.data.method, 'GET');
    const graph = await axios.post(f.base + '/graphql', { query: '{ fixture }' }, {
      ...options, headers: { 'X-Fixture': 'preserved' },
    });
    assert.deepEqual(JSON.parse(graph.data.body), { query: '{ fixture }' }); assert.equal(graph.data.marker, 'preserved');
    const form = await axios.post(f.base + '/form', new URLSearchParams({ id: '123', address: '0x123' }), options);
    assert.equal(form.data.body, 'id=123&address=0x123');
    await assert.rejects(axios.get(f.base + '/bad-br', options));
  } finally { await f.close(); }
});

if (deps.web3) {
  test('real Meterify/Web3 adapter reads block heights and balances with its extensions', async () => {
    const seen = [];
    const f = await fixture((req, res) => {
      seen.push(req.url); res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.url === '/blocks/best' ? { number: 42 } : { balance: '0x2a', energy: '0x7', hasCode: false }));
    });
    const Web3 = require('web3');
    const web3 = require('meterify').meterify(new Web3(), f.base, 2000);
    try {
      assert.equal(await web3.eth.getBlockNumber(), 42);
      assert.equal(await web3.eth.getBalance('0x1111111111111111111111111111111111111111'), '42');
      assert.equal(await web3.eth.getEnergy('0x1111111111111111111111111111111111111111'), '7');
      const encoded = web3.eth.abi.encodeParameter('uint256', '42');
      assert.equal(web3.eth.abi.decodeParameter('uint256', encoded), '42');
      assert.equal(web3.utils.toWei('1'), '1000000000000000000');
      assert.ok(seen.includes('/blocks/best')); assert.equal(typeof web3.eth.Contract, 'function');
    } finally { web3.eth.clearSubscriptions(); await f.close(); }
  });

  test('NFT metadata keeps image and JSON media types after the Axios refresh', async () => {
    const f = await fixture((req, res) => {
      if (req.url === '/json' || req.url === '/no-header') {
        if (req.url !== '/no-header') res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ image: 'data:image/svg+xml;base64,' + Buffer.from('<svg></svg>').toString('base64') }));
      } else {
        res.setHeader('Content-Type', 'image/png'); res.end(Buffer.from([137, 80, 78, 71]));
      }
    });
    const { NFTCache } = require('../dist/src/types/nftCache');
    const cache = new NFTCache(0); const uploads = [];
    cache.isCached = async () => false;
    cache.uploadToAlbum = async (address, id, body, mediaType) => uploads.push({ body, mediaType });
    try {
      for (const endpoint of ['/json', '/image', '/no-header']) {
        const nft = { address: '0x1111111111111111111111111111111111111111', tokenId: endpoint, tokenURI: f.base + endpoint, type: 'ERC721' };
        await cache.updateNFTInfo(nft);
        assert.equal(nft.status, 'cached');
      }
      assert.equal(uploads[0].mediaType, 'image/svg+xml'); assert.equal(uploads[0].body.toString(), '<svg></svg>');
      assert.equal(uploads[1].mediaType, 'image/png'); assert.deepEqual(uploads[1].body, Buffer.from([137, 80, 78, 71]));
      assert.equal(uploads[2].mediaType, 'image/svg+xml');
    } finally { await f.close(); }
  });

  test('CSV helper retains header, quoting and empty-line behavior', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-csv-'));
    try {
      const file = path.join(dir, 'fixture.csv'); fs.writeFileSync(file, 'name,value\n"Alice, Smith",42\n\n');
      assert.deepEqual(require('../dist/src/utils/csv').loadCSV(file), [{ name: 'Alice, Smith', value: '42' }]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

if (deps.xlsx) {
  test('SheetJS keeps the campaign workbook readFile/sheet_to_json interface', () => {
    const XLSX = require('xlsx');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jifen-xlsx-'));
    try {
      const rows = [{ Address: '0x1111111111111111111111111111111111111111', Points: 123.5 }];
      const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Campaign');
      const file = path.join(dir, 'fixture.xlsx'); XLSX.writeFile(book, file);
      const loaded = XLSX.readFile(file);
      assert.deepEqual(XLSX.utils.sheet_to_json(loaded.Sheets[loaded.SheetNames[0]]), rows);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('ethers, Sumer SDK and Moralis preserve the exports used by the API', async () => {
    const ethers = require('ethers'); const Sumer = require('@meterio/sumer-js');
    for (const method of ['getName', 'getAddress', 'getTokenPairs']) assert.equal(typeof Sumer[method], 'function');
    assert.ok(Sumer.abi.FeedPriceOracle);
    const abi = new ethers.Interface(Sumer.abi.FeedPriceOracle); assert.ok(abi.fragments.length);
    assert.equal(ethers.formatUnits(ethers.parseUnits('1.25', 18), 18), '1.25');
    // Public test-only key; never uses configured production accounts.
    const wallet = new ethers.Wallet('0x' + '11'.repeat(32));
    assert.equal(ethers.verifyMessage('fixture', await wallet.signMessage('fixture')), wallet.address);
    const Moralis = require('moralis').default;
    assert.equal(typeof Moralis.start, 'function'); assert.equal(typeof Moralis.EvmApi.nft.getWalletNFTs, 'function');
    assert.equal(require('moralis/common-evm-utils').EvmChain.ARBITRUM.hex, '0xa4b1');
  });

  test('pinned local PM2 starts and stops one isolated process', { timeout: 15000 }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jifen-pm2-'));
    const script = path.join(dir, 'fixture.cjs');
    fs.writeFileSync(script, "console.log('fixture-ready'); setInterval(() => {}, 1000);\n");
    const config = path.join(dir, 'pm2.json');
    fs.writeFileSync(config, JSON.stringify({ apps: [{ name: 'fixture', script, instances: '1' }] }));
    const child = spawn(process.execPath, [require.resolve('pm2/bin/pm2-runtime'), 'start', config], {
      env: { ...process.env, PM2_HOME: path.join(dir, 'home'), PM2_DISABLE_AGENT: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', () => {});
    const closed = new Promise(resolve => child.once('exit', code => resolve(code)));
    try {
      for (let i = 0; i < 100 && !output.includes('fixture-ready') && child.exitCode === null; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.match(output, /fixture-ready/); child.kill('SIGINT'); assert.equal(await closed, 0);
    } finally {
      if (child.exitCode === null) { child.kill('SIGINT'); await closed; }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
