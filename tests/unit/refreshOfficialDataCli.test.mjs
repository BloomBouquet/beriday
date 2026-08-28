import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runCli(args, env = {}) {
  const { DATA_GO_KR_API_KEY: _ignored, ...baseEnv } = process.env;
  return execFileAsync(process.execPath, ['scripts/refresh-official-data.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...baseEnv, ...env },
  });
}

test('requires an explicit validation report output before checking API credentials', async () => {
  await assert.rejects(
    runCli([
      '--output', '/tmp/official-data.json',
      '--imported-at', '2026-08-28T00:00:00.000Z',
    ]),
    (error) => {
      assert.match(error.stderr, /--report-output <json>/);
      return true;
    },
  );
});

test('requires DATA_GO_KR_API_KEY without accepting the credential on the command line', async () => {
  await assert.rejects(
    runCli([
      '--output', '/tmp/official-data.json',
      '--report-output', '/tmp/official-data-validation.json',
      '--imported-at', '2026-08-28T00:00:00.000Z',
    ]),
    (error) => {
      assert.match(error.stderr, /DATA_GO_KR_API_KEY is required/);
      return true;
    },
  );
});

test('does not modify existing asset or report when refresh cannot start without credentials', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-refresh-cli-'));
  const output = path.join(dir, 'official-data.json');
  const reportOutput = path.join(dir, 'official-data-validation.json');
  const previousAsset = '{"previousAsset":true}\n';
  const previousReport = '{"previousReport":true}\n';

  try {
    await writeFile(output, previousAsset, 'utf8');
    await writeFile(reportOutput, previousReport, 'utf8');

    await assert.rejects(
      runCli([
        '--output', output,
        '--report-output', reportOutput,
        '--imported-at', '2026-08-28T00:00:00.000Z',
      ]),
      (error) => {
        assert.match(error.stderr, /DATA_GO_KR_API_KEY is required/);
        return true;
      },
    );

    assert.equal(await readFile(output, 'utf8'), previousAsset);
    assert.equal(await readFile(reportOutput, 'utf8'), previousReport);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
