import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const folder = new URL('../docs/submission/screenshots/', import.meta.url);
const filenames = ['01-overview-six-bays.png', '02-scenario-a-wheel.png', '03-scenario-b-danger.png',
  '04-scenario-c-closeup-patrol.png', '05-ai-on-suggestion.png', '06-ai-off-manual.png'];

test('submission includes six full-resolution browser PNGs with honest individual captions', () => {
  const captions = readFileSync(new URL('README.md', folder), 'utf8');
  assert.deepEqual(readdirSync(folder).filter(name => name.endsWith('.png')).sort(), filenames);
  for (const name of filenames) {
    const png = readFileSync(new URL(name, folder));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.equal(png.readUInt32BE(16), 1800);
    assert.ok(png.readUInt32BE(20) >= 1200);
    assert.ok(png.length < 1024 * 1024);
    const caption = captions.split('\n').find(line => line.startsWith('- [') && line.includes(name));
    assert.ok(caption, name);
    assert.match(caption, /Simulation/);
    assert.match(caption, /no (real model|provider) call/i);
    if (name.startsWith('05-')) assert.match(caption, /test stub, not a real model/);
  }
  for (const pattern of [/B2-06/, /80\.0°C/, /cannot-downgrade/, /eight simulation seconds/,
    /request_closeup \+ dispatch_patrol/, /hub is warm/, /manual path/]) assert.match(captions, pattern);
});
