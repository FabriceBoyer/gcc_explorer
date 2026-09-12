import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseManPage } from '../lib/roff.mjs';
test('consecutive option labels share a body without crossing sections', () => {
  const entries = parseManPage('.SH OPTIONS\n.SS First\n.IP "-foo" 4\n.IP "-bar" 4\nShared description.\n.IP "-empty" 4\n.SS Second\n.IP "-other" 4\nOther description.');
  assert.deepEqual(entries[0].blocks, entries[1].blocks);
  assert.equal(entries[2].blocks.length, 0);
});
test('parameters, aliases and numeric diagnostic flags have documentation', () => {
  const {docs,samples}=JSON.parse(fs.readFileSync('public/data/docs.json'));
  const options=JSON.parse(fs.readFileSync('public/data/options.json'));
  assert.match(docs['--param=max-crossjump-edges='].md, /cross-jumping/);
  assert.match(docs['--all-warnings'].md, /Alias of/);
  assert.ok(options.find(o=>o.n==='-Wformat-truncation=').ex.includes('Wformat-truncation'));
  assert.equal(samples.find(s=>s.id==='Wformat-security').outputs['8'].includes('warning:'), true);
  for (const o of options) for (const id of o.ex || []) assert.ok(samples.some(s=>s.id===id));
});
