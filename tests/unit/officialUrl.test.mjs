import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOfficialUrl } from '../../dist-tests/src/security/officialUrl.js';

test('accepts verified HTTPS Korean government hosts', () => {
  assert.equal(isAllowedOfficialUrl('https://www.data.go.kr/data/15075534/fileData.do'), true);
  assert.equal(isAllowedOfficialUrl('https://bukgu.gwangju.go.kr/example'), true);
  assert.equal(isAllowedOfficialUrl('https://www.wasteguide.or.kr/front/region/region.do'), true);
});

test('rejects unsafe schemes credentials and deceptive hosts', () => {
  assert.equal(isAllowedOfficialUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedOfficialUrl('data:text/html,test'), false);
  assert.equal(isAllowedOfficialUrl('http://www.data.go.kr/data'), false);
  assert.equal(isAllowedOfficialUrl('https://user:pass@www.data.go.kr/data'), false);
  assert.equal(isAllowedOfficialUrl('https://data.go.kr.attacker.com/phish'), false);
  assert.equal(isAllowedOfficialUrl('https://example.com/data'), false);
});
