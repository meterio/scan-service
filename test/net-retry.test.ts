/**
 * Tests for the HTTP layer's transient-failure handling.
 *
 * The public RPC sits behind Cloudflare, which resets pooled keep-alive
 * connections; before retries existed, one such reset propagated into the sync
 * loop and cost a recovery sleep plus a full dirty-data cleanup.
 *
 * Run with: npm test
 */
import assert from 'assert';
import * as http from 'http';

import { Net } from '../src/utils/net';

interface Fixture {
  base: string;
  requests: number;
  close: () => Promise<void>;
}

const startServer = (handler: (req: http.IncomingMessage, res: http.ServerResponse, n: number) => void): Promise<Fixture> =>
  new Promise((resolve) => {
    const fixture: any = { requests: 0 };
    const server = http.createServer((req, res) => {
      fixture.requests++;
      handler(req, res, fixture.requests);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      fixture.base = `http://127.0.0.1:${addr.port}`;
      fixture.close = () =>
        new Promise<void>((r) => {
          server.closeAllConnections?.();
          server.close(() => r());
        });
      resolve(fixture as Fixture);
    });
  });

const ok = (res: http.ServerResponse) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
};

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test('GET retries after a connection reset and succeeds', async () => {
  const f = await startServer((req, res, n) => {
    if (n === 1) {
      req.socket.destroy(); // client sees ECONNRESET / socket hang up
      return;
    }
    ok(res);
  });
  try {
    const net = new Net(f.base);
    const out: any = await net.http('GET', 'blocks/1');
    assert.deepStrictEqual(out, { ok: true }, 'the retry must return the payload');
    assert.strictEqual(f.requests, 2, 'exactly one retry expected');
  } finally {
    await f.close();
  }
});

test('GET gives up after the attempt limit', async () => {
  const f = await startServer((req) => req.socket.destroy());
  try {
    const net = new Net(f.base);
    await assert.rejects(() => net.http('GET', 'blocks/1'), /socket hang up|ECONNRESET/);
    assert.strictEqual(f.requests, 3, 'should stop at MAX_ATTEMPTS');
  } finally {
    await f.close();
  }
});

test('GET retries a 503 from the edge', async () => {
  const f = await startServer((req, res, n) => {
    if (n === 1) {
      res.writeHead(503);
      res.end('unavailable');
      return;
    }
    ok(res);
  });
  try {
    const net = new Net(f.base);
    const out: any = await net.http('GET', 'blocks/1');
    assert.deepStrictEqual(out, { ok: true });
    assert.strictEqual(f.requests, 2, 'exactly one retry expected');
  } finally {
    await f.close();
  }
});

test('GET does not retry a 404', async () => {
  const f = await startServer((req, res) => {
    res.writeHead(404);
    res.end('nope');
  });
  try {
    const net = new Net(f.base);
    await assert.rejects(() => net.http('GET', 'blocks/1'), /404/);
    assert.strictEqual(f.requests, 1, 'a deterministic status must not be replayed');
  } finally {
    await f.close();
  }
});

test('POST is never replayed', async () => {
  const f = await startServer((req) => req.socket.destroy());
  try {
    const net = new Net(f.base);
    await assert.rejects(() => net.http('POST', 'debug/tracers', { body: { a: 1 } }));
    assert.strictEqual(f.requests, 1, 'POST may not be idempotent, so it must not retry');
  } finally {
    await f.close();
  }
});

test('a stalled request rejects instead of hanging forever', async () => {
  const f = await startServer(() => {
    /* never respond */
  });
  try {
    const net = new Net(f.base, 300); // 300ms timeout
    const started = Date.now();
    await assert.rejects(() => net.http('GET', 'blocks/1'), /timed out/);
    assert.ok(Date.now() - started < 10000, 'must not hang');
  } finally {
    await f.close();
  }
});

test('sends a User-Agent, and lets callers override it', async () => {
  // Regression: Node sets no UA by default and CoinGecko answers 403 without
  // one, which silently broke MTR/MTRG price updates for months.
  let seen: string | undefined;
  const f = await startServer((req, res) => {
    seen = req.headers['user-agent'];
    ok(res);
  });
  try {
    const net = new Net(f.base);
    await net.http('GET', 'simple/price');
    assert.ok(seen && seen.length > 0, 'a User-Agent must be sent');

    await net.http('GET', 'simple/price', { headers: { 'User-Agent': 'custom-agent' } });
    assert.strictEqual(seen, 'custom-agent', 'an explicit User-Agent must win');
  } finally {
    await f.close();
  }
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ok   ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${t.name}`);
      console.log(`       ${(e as Error).message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
})();
