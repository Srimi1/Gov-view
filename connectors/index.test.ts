import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("source selection loads only selected connector extraction metadata", () => {
  const result = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const reads = [];
    const original = fs.readFileSync;
    fs.readFileSync = function(path, ...args) {
      const name = String(path);
      if (name.includes('/data/extractions/')) {
        reads.push(name);
        if (!name.endsWith('/apeda-associates-2026.json')) {
          throw new Error('Unrelated connector metadata was read: ' + name);
        }
      }
      return original.call(this, path, ...args);
    };
    syncBuiltinESMExports();
    const { connectors } = await import('./connectors/index.ts');
    assert.equal(reads.length, 0, 'Registry startup must not read extraction data');
    const registry = JSON.parse(original('./sources/registry.json', 'utf8'));
    for (const source of registry.sources) {
      if (source.connector !== 'none') assert.equal(typeof connectors[source.connector], 'function', source.id);
    }
    await assert.rejects(connectors['apeda-associates-2026']({
      source: registry.sources.find(s => s.id === 'in-apeda-associates-2026'),
      now: new Date('2026-09-27T00:00:00Z'), env: {}, log: () => {},
      fetchText: async () => { throw new Error('Selected connector reached fetch'); },
      fetchBytes: async () => { throw new Error('Unexpected PDF fetch'); },
    }), /Selected connector reached fetch/);
    assert.equal(reads.length, 1);
    assert.ok(reads[0].endsWith('/apeda-associates-2026.json'));
    console.log('Only selected APEDA metadata loaded');
  `], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] });
  assert.match(result, /Only selected APEDA metadata loaded/);
});
