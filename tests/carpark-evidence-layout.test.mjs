import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../dist/carpark/carpark.mjs', import.meta.url), 'utf8');
const css = await readFile(new URL('../dist/carpark/carpark.css', import.meta.url), 'utf8');

test('thermal and 3D live in a workspace column beside the floor, not inside the decision sidebar', () => {
  const workspace = page.slice(page.indexOf('class="cp-workspace"'), page.indexOf('document.querySelector(\'.view-tabs\')'));
  assert.match(workspace, /cp-map-column[\s\S]*id="cpEvidencePanel"[\s\S]*class="cp-sidebar"/);
  assert.match(page, /\$\('cpEvidencePanel'\)\.append\(details\)/);
  assert.equal(page.includes("decisionHost.after(details)"), false);
  assert.match(page, /cpSelectedOccupancy'\)\.after\(decisionHost\)/);
});

test('desktop CSS keeps the evidence column on the first workspace row', () => {
  assert.match(css, /grid-template-columns:minmax\(0,1\.1fr\) minmax\(400px,1\.05fr\) 320px/);
  assert.match(css, /\.cp-evidence-panel\{grid-column:2;grid-row:1\}/);
  assert.match(css, /\.cp-evidence-panel \.cp-frame-views\{grid-template-columns:1fr 1fr\}/);
  assert.match(css, /@media\(max-width:1100px\)[\s\S]*\.cp-evidence-panel\{grid-column:1;grid-row:2\}/);
});
