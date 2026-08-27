import test from 'node:test';
import assert from 'node:assert/strict';
import { searchItems } from '../../dist-tests/src/domain/items/searchItems.js';

test('searchItems matches aliases after whitespace normalization', () => {
  const result = searchItems('  스티로폼   박스 ');
  assert.ok(result.length > 0);
  assert.equal(result[0].id, 'styrofoam-box');
});

test('searchItems returns no results for empty query and does not invent unknown items', () => {
  assert.deepEqual(searchItems(''), []);
  assert.deepEqual(searchItems('우주쓰레기마법상자'), []);
});

test('search item keeps source provenance separate from regional schedule', () => {
  const [item] = searchItems('젤 아이스팩');
  assert.equal(item.category, 'general');
  assert.match(item.sourceUrl, /^https:\/\//);
  assert.ok(item.preparation.length > 0);
});
