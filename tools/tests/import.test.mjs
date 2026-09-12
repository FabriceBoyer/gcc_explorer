import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
const compiled = await build({ entryPoints: ['src/lib/import.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { parseImport, previewImport, tokenizeFlags } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const rows = JSON.parse(fs.readFileSync('public/data/options.json'));
const versions = [8,9,10,11,12,13,14,15];
const preview = text => previewImport(parseImport(text, 'text'), rows, versions, 8);
test('quotes, continuation, comments, negative and joined options', () => {
  const p = preview('-Wall \\\n-Wno-unused-variable -O2 -I "include path" -DNAME="hello world" # comment\n-Wall');
  assert.equal(p.recognized.length, 5);
  assert.equal(p.warnings.length, 0);
  assert.ok(p.recognized.some(f => f.flag === '-I "include path"'));
});
test('unknown flags, missing arguments and substitutions are explicit', () => {
  const p = preview('-not-a-real-option -I -Wall ${FLAGS} -std=');
  assert.equal(p.warnings.length, 4);
  assert.deepEqual(p.recognized.map(f => f.flag), ['-Wall']);
  assert.throws(() => tokenizeFlags('-DNAME="oops'), /quotation/);
});
test('version warning and parameter lookup', () => {
  const p = preview('-fhardened --param max-crossjump-edges=10 -Wl,-z,relro');
  assert.equal(p.recognized.length, 3);
  assert.equal(p.recognized[0].unavailable, true);
  assert.equal(p.recognized[1].option, '--param=max-crossjump-edges=');
});
test('Explorer JSON merges compile and link without losing distinct flags', () => {
  const tokens = parseImport(JSON.stringify({compile:['-Wall','-Wl,-z,relro'],link:['-Wl,-z,now','-Wall']}), 'json');
  assert.equal(previewImport(tokens, rows, versions, 15).recognized.length, 3);
  assert.throws(() => parseImport('{"compile":"-Wall","link":[]}', 'json'));
  assert.throws(() => parseImport('[42]', 'json'));
});
