import type { OfficialDataBundle } from './officialDataBundle.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidField(message: string): never {
  throw new Error(`Invalid official data asset: ${message}`);
}

export function serializeOfficialDataAsset(bundle: OfficialDataBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function loadOfficialDataAsset(text: string): OfficialDataBundle {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid official data asset JSON');
  }

  if (!isRecord(parsed)) {
    invalidField('root must be an object');
  }

  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported official data asset schemaVersion: ${String(parsed.schemaVersion)}`);
  }

  if (typeof parsed.importedAt !== 'string') {
    invalidField('importedAt must be a string');
  }

  if (!Array.isArray(parsed.regions)) {
    invalidField('regions must be an array');
  }

  if (!Array.isArray(parsed.rules)) {
    invalidField('rules must be an array');
  }

  if (!isRecord(parsed.reports)) {
    invalidField('reports must be an object');
  }

  return parsed as OfficialDataBundle;
}
