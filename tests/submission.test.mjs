import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('judge documents retain runnable commands, simulation boundaries and dated evaluation limits', () => {
  for (const file of ['README.md', 'docs/submission/JUDGE_RUN.md']) {
    const doc = read(file);
    for (const pattern of [/Node\.js 24\+/, /node serve\.mjs/, /127\.0\.0\.1:4173\/\?lang=en/, /no npm install/i,
      /simulation/i, /cannot be exported/, /Danger cannot be downgraded/i, /13\/15/, /6\/15/, /10 October 2026/,
      /12 October 2026/, /ok=false/, /not vehicle accuracy/i, /No three-person user test/i,
      /VOLTGUARD_AI_ENABLED=true/, /VOLTGUARD_AI_BASE_URL/, /VOLTGUARD_AI_MODEL/, /VOLTGUARD_AI_API_KEY/,
      /qwen3-vl-plus/, /test stub, not a real model/, /Ctrl\+C/]) assert.match(doc, pattern, `${file}: ${pattern}`);
    assert.doesNotMatch(doc, /Admin1|[A-Z]:\\|\/Users\//i, file);
  }
});

test('credential example has empty values and private files remain ignored', () => {
  const entries = read('.env.example').split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
  assert.equal(entries.length, 6);
  for (const entry of entries) assert.match(entry, /^[A-Z_]+=$/);
  const ignore = read('.gitignore');
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.sites-runtime\/$/m);
});

test('NASA-era pitch assets are retained and explicitly marked historical', () => {
  const doc = read('pitch/README.md');
  for (const name of ['pitch-deck.pptx', 'demo-script.md', 'qa.md', 'demo-backup.webm']) {
    assert.ok(doc.includes(name));
    assert.ok(readFileSync(new URL('../pitch/' + name, import.meta.url)).length > 0);
  }
  assert.match(doc, /3 October/);
  assert.match(doc, /Do not use these files as the 18 October 2026/);
});

test('published judge instructions share the verified public repository and clone URL', () => {
  const web = 'https://github.com/OrionMarx-1/voltguard';
  for (const file of ['README.md', 'docs/submission/JUDGE_RUN.md']) {
    const doc = read(file);
    assert.ok(doc.includes(`](${web})`), file);
    assert.ok(doc.includes(`${web}.git`), file);
  }
  assert.ok(read('docs/submission/JUDGE_RUN.md').replace(/\r\n/g, '\n').includes(`git clone ${web}.git\ncd voltguard\nnode --version\nnode serve.mjs`));
});
