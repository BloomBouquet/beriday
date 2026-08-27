import test from 'node:test';
import assert from 'node:assert/strict';
import { getBulkDisposalGuide } from '../../dist-tests/src/domain/bulk/guides.js';

test('returns the verified Gangnam-gu official bulk-waste procedure', () => {
  const guide = getBulkDisposalGuide('서울특별시', '강남구');

  assert.ok(guide);
  assert.equal(guide.authorityName, '강남구청');
  assert.equal(guide.departmentName, '자원순환과');
  assert.equal(guide.contact, '02-3423-5974');
  assert.equal(guide.procedureUrl, 'https://www.gangnam.go.kr/waste/apply/info.do?mid=ID03_030702');
  assert.equal(guide.sourceName, '강남구청 대형생활폐기물');
});

test('returns the verified Haeundae-gu official bulk-waste procedure', () => {
  const guide = getBulkDisposalGuide('부산광역시', '해운대구');

  assert.ok(guide);
  assert.equal(guide.authorityName, '해운대구청');
  assert.equal(guide.departmentName, '자원순환과');
  assert.equal(guide.contact, '051-749-4462');
  assert.match(guide.procedureUrl, /^https:\/\/www\.haeundae\.go\.kr\//);
});

test('returns null instead of guessing a bulk-waste link for an unverified municipality', () => {
  assert.equal(getBulkDisposalGuide('광주광역시', '북구'), null);
  assert.equal(getBulkDisposalGuide('서울특별시', '없는구'), null);
});
