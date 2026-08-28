import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('production build is rooted at the BloomBouquet Beriday subpath', () => {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');

  assert.match(viteConfig, /base:\s*['"]\/apps\/beriday\/['"]/);
});

test('default runtime manifest URL follows the Vite app base instead of the domain root', () => {
  const app = fs.readFileSync('src/OfficialDataApp.tsx', 'utf8');

  assert.match(app, /import\.meta\.env\.BASE_URL/);
  assert.doesNotMatch(app, /const DEFAULT_MANIFEST_URL = ['"]\/data\/runtime\/manifest\.json['"]/);
  assert.match(app, /data\/runtime\/manifest\.json/);
});
