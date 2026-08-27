import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRegionId, parseTimeWindows, parseWeekdays } from '../../dist-tests/src/domain/waste/parse.js';

test('parseWeekdays handles Korean weekday variants and mixed delimiters', () => {
  assert.deepEqual(parseWeekdays('월, 수/금요일'), [1, 3, 5]);
  assert.deepEqual(parseWeekdays('매일'), [0, 1, 2, 3, 4, 5, 6]);
});

test('parseWeekdays returns null for empty or unknown input', () => {
  assert.equal(parseWeekdays(''), null);
  assert.equal(parseWeekdays('둘째주'), null);
});

test('parseTimeWindows parses normal and cross-midnight windows', () => {
  assert.deepEqual(parseTimeWindows('20:00~02:00'), [{ start: '20:00', end: '02:00' }]);
  assert.deepEqual(parseTimeWindows('18시 이후'), [{ start: '18:00', end: null }]);
});

test('parseTimeWindows rejects malformed time text', () => {
  assert.equal(parseTimeWindows('저녁쯤'), null);
  assert.equal(parseTimeWindows('25:00~02:00'), null);
});

test('makeRegionId is deterministic and rejects missing keys', () => {
  assert.equal(makeRegionId('광주광역시', '북구', '일곡동'), '광주광역시/북구/일곡동');
  assert.throws(() => makeRegionId('광주광역시', '', '일곡동'), /region key/i);
});
