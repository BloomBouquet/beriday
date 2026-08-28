import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOfficialHouseholdWasteApiRows } from '../../dist-tests/src/data/import/householdWasteApi.js';

test('reports the underlying network error code without exposing the service key', async () => {
  const secret = 'super-secret-service-key';
  const networkError = new Error('fetch failed', {
    cause: Object.assign(new Error('Connect Timeout Error'), {
      code: 'UND_ERR_CONNECT_TIMEOUT',
    }),
  });

  await assert.rejects(
    fetchOfficialHouseholdWasteApiRows({
      serviceKey: secret,
      fetchImpl: async () => {
        throw networkError;
      },
    }),
    (error) => {
      assert.match(error.message, /Official Open API request failed: fetch failed/);
      assert.match(error.message, /UND_ERR_CONNECT_TIMEOUT/);
      assert.doesNotMatch(error.message, new RegExp(secret));
      return true;
    },
  );
});
