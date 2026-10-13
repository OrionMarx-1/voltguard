import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sw = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
const assets = sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)[1];

test('service worker cache name is current and includes the six-bay layout', () => {
  assert.match(sw, /const CACHE_NAME = 'voltguard-demo-v27'/);
  assert.match(assets, /carpark-b2\.json/);
  assert.match(assets, /operator-copy\.mjs/);
});

test('shell and carpark assets try the network before a cached copy', () => {
  assert.equal(sw.includes('cached => cached || fetch(request)'), false);
  assert.match(sw, /mode === 'navigate'[\s\S]*?fetch\(request\)[\s\S]*?caches\.match\('\.\/'\)/);
  assert.match(sw, /pathname\.includes\('\/carpark\/'\)[\s\S]*?fetch\(request\)[\s\S]*?caches\.match\(request/);
});
