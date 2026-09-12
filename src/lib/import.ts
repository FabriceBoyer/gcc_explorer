import type { OptionRow } from './types';
export type ImportFormat = 'text' | 'ant' | 'json';
export interface ImportToken { value: string; raw: string }
export interface ImportPreview { recognized: { flag: string; option: string; unavailable: boolean }[]; warnings: string[] }

/** A tokenizer, never a shell evaluator. Preserve spelling and quoting. */
export function tokenizeFlags(text: string): ImportToken[] {
  const result: ImportToken[] = [];
  let value = '', raw = '', quote = '';
  const flush = () => { if (raw) result.push({ value, raw }); value = ''; raw = ''; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!quote && c === '#' && !raw) { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '\\' && quote !== "'") {
      const next = text[++i];
      if (next === undefined) throw new Error('Incomplete escape at the end of the input.');
      if (next !== '\n') { raw += c + next; value += next; }
    } else if (c === quote) { raw += c; quote = ''; }
    else if (!quote && (c === '"' || c === "'")) { quote = c; raw += c; }
    else if (!quote && /\s/.test(c)) flush();
    else { raw += c; value += c; }
  }
  if (quote) throw new Error('Unclosed quotation mark.');
  flush(); return result;
}
const atomic = (value: string): ImportToken => ({ value, raw: /[\s'"\\]/.test(value) ? "'" + value.replace(/'/g, "'\\''") + "'" : value });
export function parseImport(text: string, format: ImportFormat): ImportToken[] {
  if (text.length > 1_000_000) throw new Error('Input is too large (maximum 1 MB).');
  if (format === 'text') return tokenizeFlags(text);
  if (format === 'json') {
    const data = JSON.parse(text);
    const values = Array.isArray(data) ? data : [...(data.compile ?? []), ...(data.link ?? [])];
    if (!Array.isArray(data) && (!Array.isArray(data.compile) || !Array.isArray(data.link))) throw new Error('Expected a string array or GCC Explorer JSON with compile and link arrays.');
    if (!values.every((v: unknown) => typeof v === 'string')) throw new Error('JSON flags must be strings.');
    // Explorer exports full flags, including separate argument spellings.
    return values.flatMap((v: string) => tokenizeFlags(v));
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML document types and entities are not supported.');
  const source = text.replace(/^\s*<\?xml[^?]*\?>/, '');
  const doc = new DOMParser().parseFromString(`<import>${source}</import>`, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML. Paste compilerarg/linkerarg elements or an Ant file.');
  const nodes = Array.from(doc.querySelectorAll('compilerarg, linkerarg'));
  if (!nodes.length) throw new Error('No compilerarg or linkerarg elements found.');
  return nodes.flatMap(node => {
    if (node.hasAttribute('line') && !node.hasAttribute('value')) return tokenizeFlags(node.getAttribute('line')!);
    if (node.hasAttribute('value') && !node.hasAttribute('line')) return [atomic(node.getAttribute('value')!)];
    throw new Error('Each Ant argument must have exactly one value or line attribute. Properties and files are not expanded.');
  });
}
const separate = new Set(['-I', '-L', '-D', '-U', '-l', '-B', '-o', '-x', '-include', '-imacros', '-isystem', '-iquote', '-idirafter', '-isysroot', '--sysroot', '-Xlinker', '-Xassembler', '-Xpreprocessor', '-MF', '-MT', '-MQ', '-T', '-u', '-e', '-z', '--param']);
export function previewImport(tokens: ImportToken[], rows: OptionRow[], versions: number[], version: number): ImportPreview {
  const byName = new Map(rows.map(row => [row.n, row]));
  const stems = rows.filter(row => /[=,]$/.test(row.n)).sort((a,b) => b.n.length - a.n.length);
  const recognized: ImportPreview['recognized'] = [], warnings: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]; let flag = token.raw, value = token.value;
    if (/[`$]/.test(value)) { warnings.push(`${flag}: variables and substitutions are not expanded.`); continue; }
    if (separate.has(value)) {
      const next = tokens[i + 1];
      if (!next || (next.value.startsWith('-') && !value.startsWith('-X'))) { warnings.push(`${flag}: missing argument.`); continue; }
      if (/[`$]/.test(next.value)) { warnings.push(`${flag} ${next.raw}: unresolved argument.`); i++; continue; }
      flag += ' ' + next.raw; i++;
      if (value === '--param') value = '--param=' + next.value;
    }
    let row = byName.get(value) ?? stems.find(r => value.startsWith(r.n) && value.length > r.n.length);
    if (!row && /^-[Wfm]no-/.test(value)) {
      const positive = value.replace(/^(-[Wfm])no-/, '$1');
      row = byName.get(positive) ?? stems.find(r => positive.startsWith(r.n) && positive.length > r.n.length);
    }
    if (!row && /^-[DUIlLB].+/.test(value)) row = byName.get(value.slice(0,2));
    if (!row && /^-O(?:[0-3sg]|fast)$/.test(value)) row = byName.get('-O');
    if (!row && /^-g[0-3]$/.test(value)) row = byName.get('-g');
    if (!row) { warnings.push(`${flag}: not found in the catalogue.`); continue; }
    if (/[=,]$/.test(value)) { warnings.push(`${flag}: missing argument.`); continue; }
    if (!seen.has(flag)) recognized.push({ flag, option: row.n, unavailable: !(row.m & (1 << versions.indexOf(version))) });
    seen.add(flag);
  }
  return { recognized, warnings };
}
