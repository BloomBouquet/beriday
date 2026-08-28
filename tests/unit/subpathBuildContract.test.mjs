import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('production build is rooted at the BloomBouquet Beriday subpath', () => {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');

  assert.match(viteConfig, /base:\s*['"]\/apps\/beriday\/['"]/);
});

test('default runtime manifest URL follows the Vite base instead of the domain root', () => {
  const loader = fs.readFileSync('src/data/runtime/officialRuntimeLoader.ts', 'utf8');

  assert.match(loader, /import\.meta\.env\.BASE_URL/);
  assert.doesNotMatch(loader, /const DEFAULT_MANIFEST_URL = ['"]\/data\/runtime\/manifest\.json['"]/);
  assert.match(loader, /data\/runtime\/manifest\.json/);
});
