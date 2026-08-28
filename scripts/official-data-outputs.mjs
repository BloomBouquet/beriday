import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeOfficialDataOutputs({
  assetOutput,
  reportOutput,
  asset,
  report,
}) {
  const resolvedAssetOutput = path.resolve(assetOutput);
  const resolvedReportOutput = path.resolve(reportOutput);

  if (resolvedAssetOutput === resolvedReportOutput) {
    throw new Error('Official data asset and validation report must use different paths.');
  }

  await Promise.all([
    mkdir(path.dirname(resolvedAssetOutput), { recursive: true }),
    mkdir(path.dirname(resolvedReportOutput), { recursive: true }),
  ]);

  const token = `${process.pid}-${randomUUID()}`;
  const temporaryAsset = `${resolvedAssetOutput}.tmp-${token}`;
  const temporaryReport = `${resolvedReportOutput}.tmp-${token}`;

  try {
    await Promise.all([
      writeFile(temporaryAsset, asset, { encoding: 'utf8', flag: 'wx' }),
      writeFile(temporaryReport, report, { encoding: 'utf8', flag: 'wx' }),
    ]);

    await rename(temporaryReport, resolvedReportOutput);
    await rename(temporaryAsset, resolvedAssetOutput);
  } finally {
    await Promise.all([
      rm(temporaryAsset, { force: true }),
      rm(temporaryReport, { force: true }),
    ]);
  }
}
