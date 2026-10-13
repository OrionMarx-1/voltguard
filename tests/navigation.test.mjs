import test from 'node:test';
import assert from 'node:assert/strict';
import { initialView, navigationState, chromeState, NASA_VIEWS } from '../dist/navigation.mjs';

test('home and unknown routes open carpark; all existing NASA deep links retain their view', () => {
  for (const search of ['', '?lang=en', '?view=unknown', '?view=']) assert.equal(initialView(search), 'carpark');
  for (const view of ['carpark', ...NASA_VIEWS]) assert.equal(initialView(`?lang=en&view=${view}&cell=B0018`), view);
});

test('NASA subviews belong to rule validation and the most recent subview survives a carpark round trip', () => {
  let state = navigationState('carpark'); assert.deepEqual(state, { section: 'carpark', lastNASAView: 'fleet' });
  for (const view of NASA_VIEWS) {
    state = navigationState(view, state.lastNASAView); assert.deepEqual(state, { section: 'rules', lastNASAView: view });
    state = navigationState('carpark', state.lastNASAView); assert.deepEqual(state, { section: 'carpark', lastNASAView: view });
  }
  assert.deepEqual(navigationState('unknown', 'unknown'), { section: 'carpark', lastNASAView: 'fleet' });
});

test('homepage chrome hides NASA; deep-linked NASA pages keep a back control and NASA subnav', () => {
  assert.deepEqual(chromeState('carpark'), { primaryHidden: true, rulesHidden: true, nasaHidden: true });
  assert.deepEqual(chromeState('rules'), { primaryHidden: false, rulesHidden: true, nasaHidden: false });
});
