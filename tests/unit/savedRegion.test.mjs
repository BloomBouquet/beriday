import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSavedRegion, getSavedRegion, saveRegion } from '../../dist-tests/src/storage/savedRegion.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    dump() { return values; }
  };
}

const valid = new Set(['광주광역시/북구/일곡동']);

test('getSavedRegion returns valid known region', () => {
  const storage = memoryStorage({
    'beriday:saved-region:v1': JSON.stringify({ regionId: '광주광역시/북구/일곡동', savedAt: '2026-08-27T00:00:00.000Z' })
  });
  assert.deepEqual(getSavedRegion(valid, storage), { regionId: '광주광역시/북구/일곡동', savedAt: '2026-08-27T00:00:00.000Z' });
});

test('corrupt or unknown saved region is removed and returns null', () => {
  const storage = memoryStorage({ 'beriday:saved-region:v1': '{bad json' });
  assert.equal(getSavedRegion(valid, storage), null);
  assert.equal(storage.getItem('beriday:saved-region:v1'), null);

  const unknown = memoryStorage({
    'beriday:saved-region:v1': JSON.stringify({ regionId: '없는지역', savedAt: '2026-08-27T00:00:00.000Z' })
  });
  assert.equal(getSavedRegion(valid, unknown), null);
  assert.equal(unknown.getItem('beriday:saved-region:v1'), null);
});

test('saveRegion rejects unknown region and clear removes known region', () => {
  const storage = memoryStorage();
  assert.throws(() => saveRegion('없는지역', valid, storage), /unknown region/i);
  const saved = saveRegion('광주광역시/북구/일곡동', valid, storage, new Date('2026-08-27T00:00:00.000Z'));
  assert.equal(saved.regionId, '광주광역시/북구/일곡동');
  clearSavedRegion(storage);
  assert.equal(storage.getItem('beriday:saved-region:v1'), null);
});
