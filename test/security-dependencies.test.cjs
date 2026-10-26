const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');

// A clean vulnerable install can be selected to demonstrate these regressions.
const from = createRequire(path.join(
  process.env.SECURITY_DEPENDENCY_ROOT || path.resolve(__dirname, '..'),
  'package.json'
));
const FormData = from('form-data');
const mongoose = from('mongoose');
const proxyaddr = from('proxy-addr');

test('multipart boundaries cannot be predicted by controlling Math.random', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  assert.notEqual(new FormData().getBoundary(), new FormData().getBoundary());
});

test('multipart field names and filenames cannot inject header lines', () => {
  for (const attack of ['field', 'filename']) {
    const form = new FormData();
    const injected = 'input"\r\nX-Injected: true';
    form.append(attack === 'field' ? injected : 'normal', 'value', {
      filename: attack === 'filename' ? injected : 'normal.txt',
    });
    assert.doesNotMatch(form.getBuffer().toString(), /\r\nX-Injected: true/);
  }
  const normal = new FormData();
  normal.append('normal', 'value', { filename: 'normal.txt' });
  assert.match(normal.getBuffer().toString(), /name="normal"; filename="normal.txt"/);
});

// Request pins an older compatible multipart major; verify that copy too.
let requestFormData;
try { requestFormData = createRequire(from.resolve('request/package.json'))('form-data'); }
catch (err) { if (err.code !== 'MODULE_NOT_FOUND') throw err; }
if (requestFormData) {
  test('legacy Request multipart boundaries and headers are also safe', (t) => {
    t.mock.method(Math, 'random', () => 0.5);
    assert.notEqual(new requestFormData().getBoundary(), new requestFormData().getBoundary());
    for (const attack of ['field', 'filename']) {
      const form = new requestFormData();
      const injected = 'input"\r\nX-Injected: true';
      form.append(attack === 'field' ? injected : 'normal', 'value', {
        filename: attack === 'filename' ? injected : 'normal.txt',
      });
      assert.doesNotMatch(form.getBuffer().toString(), /\r\nX-Injected: true/);
    }
  });
}

test('Mongoose update casting cannot mutate Object.prototype via dotted paths', () => {
  const Model = mongoose.model('SecurityUpdateCasting', new mongoose.Schema({ name: String }));
  try {
    for (const prefix of ['__proto__', 'constructor.prototype']) {
      const tracked = ['$fullPath', '$parentSchemaDocArray', 'dependencyPollution'];
      const before = new Map(tracked.map(k => [k, Object.getOwnPropertyDescriptor(Object.prototype, k)]));
      const update = { $set: { [prefix + '.dependencyPollution']: 'untrusted' } };
      let after;
      try {
        try { Model.updateOne({}, {})._castUpdate(update); } catch (_) { /* Rejecting is safe. */ }
        after = new Map(tracked.map(k => [k, Object.getOwnPropertyDescriptor(Object.prototype, k)]));
      } finally {
        for (const [key, descriptor] of before) {
          if (descriptor) Object.defineProperty(Object.prototype, key, descriptor);
          else delete Object.prototype[key];
        }
      }
      for (const key of tracked) assert.deepEqual(after.get(key), before.get(key), `${prefix}: ${key}`);
    }
    const normal = Model.updateOne({}, {})._castUpdate({ $set: { name: 'Alice' } });
    assert.equal(normal.$set.name, 'Alice');
  } finally { mongoose.deleteModel('SecurityUpdateCasting'); }
});

test('Mongoose sanitizes nested query operators inside $nor', () => {
  const filter = { $nor: [{ name: { $ne: null } }] };
  mongoose.sanitizeFilter(filter);
  assert.deepEqual(filter, { $nor: [{ name: { $eq: { $ne: null } } }] });
});

test('IPv6 trust ranges cannot unintentionally trust arbitrary IPv4 peers', () => {
  for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    assert.equal(proxyaddr.compile(subnet)('198.51.100.23'), false, subnet);
  }
  for (const subnet of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
    const trust = proxyaddr.compile(subnet);
    assert.equal(trust('10.20.30.40'), true);
    assert.equal(trust('198.51.100.23'), false);
  }
});
