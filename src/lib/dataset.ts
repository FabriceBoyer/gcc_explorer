/**
 * Loads the generated dataset and keeps it in the browser.
 *
 * `manifest.json` is tiny and always re-validated against the network; it
 * carries a content hash. The two big payloads (`options.json`, `docs.json`)
 * are keyed by that hash in IndexedDB, so a repeat visit is a single 4 KB
 * request and everything else comes from disk. When the network is gone we
 * fall back to whatever is cached, which makes the whole site usable offline.
 */
import type { Docs, Manifest, OptionRow, ProfileFile, RawOption } from './types';
import { idbGet, idbSet, idbKeys, idbDel, idbClear } from './idb';

const BASE = `${import.meta.env.BASE_URL}data/`;

export type LoadPhase = 'manifest' | 'options' | 'profiles' | 'ready';

export interface LoadProgress {
  phase: LoadPhase;
  fromCache: boolean;
}

async function fetchJson<T>(file: string, revalidate = false): Promise<T> {
  const res = await fetch(BASE + file, { cache: revalidate ? 'no-cache' : 'default' });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Fetches a file, or returns the copy stored under the current dataset hash. */
async function cached<T>(file: string, hash: string, onCache?: (hit: boolean) => void): Promise<T> {
  const key = `${file}@${hash}`;
  const hit = await idbGet<T>(key);
  if (hit) {
    onCache?.(true);
    return hit;
  }
  const data = await fetchJson<T>(file);
  onCache?.(false);
  void idbSet(key, data).then(() => pruneStaleEntries(hash));
  return data;
}

/** Drops payloads left over from an older dataset build. */
async function pruneStaleEntries(hash: string) {
  const keys = (await idbKeys()) ?? [];
  for (const k of keys) {
    if (typeof k === 'string' && k.includes('@') && !k.endsWith(`@${hash}`)) await idbDel(k);
  }
}

export interface Dataset {
  manifest: Manifest;
  options: OptionRow[];
  byName: Map<string, OptionRow>;
  profiles: ProfileFile;
  /** Lazily fetched; `undefined` until `loadDocs()` resolves. */
  docs?: Docs;
  fromCache: boolean;
}

/** `1 << i` for the i-th release in `manifest.versions`. */
export function versionBit(versions: number[], v: number): number {
  const i = versions.indexOf(v);
  return i < 0 ? 0 : 1 << i;
}

export function maskToVersions(versions: number[], mask: number): number[] {
  return versions.filter((_, i) => mask & (1 << i));
}

function enrich(raw: RawOption[], manifest: Manifest, profiles: ProfileFile): OptionRow[] {
  const profileOf = new Map<string, string[]>();
  for (const p of profiles.profiles) {
    for (const f of p.flags) {
      const name = f.option ?? f.flag;
      const list = profileOf.get(name) ?? [];
      list.push(p.id);
      profileOf.set(name, list);
    }
  }

  return raw.map((o) => {
    const present = maskToVersions(manifest.versions, o.m);
    const since = present[0] ?? manifest.versions[0];
    const until = present[present.length - 1] ?? manifest.versions[manifest.versions.length - 1];
    const newest = manifest.versions[manifest.versions.length - 1];
    return {
      ...o,
      since,
      until,
      range: since === until ? `${since}` : `${since} – ${until}${until < newest ? ' ✕' : ''}`,
      search: `${o.n} ${o.d}`.toLowerCase(),
      packNames: o.pk ? Object.keys(o.pk) : [],
      profiles: profileOf.get(o.n) ?? [],
    };
  });
}

export async function loadDataset(onProgress?: (p: LoadProgress) => void): Promise<Dataset> {
  let fromCache = false;
  const note = (phase: LoadPhase, hit = false) => {
    fromCache = fromCache || hit;
    onProgress?.({ phase, fromCache: hit });
  };

  note('manifest');
  let manifest: Manifest;
  try {
    manifest = await fetchJson<Manifest>('manifest.json', true);
    void idbSet('manifest', manifest);
  } catch (err) {
    const offline = await idbGet<Manifest>('manifest');
    if (!offline) throw err;
    manifest = offline;
    fromCache = true;
  }

  note('options');
  const raw = await cached<RawOption[]>('options.json', manifest.hash, (hit) => note('options', hit));

  note('profiles');
  const profiles = await cached<ProfileFile>('profiles.json', manifest.hash, (hit) => note('profiles', hit));

  const options = enrich(raw, manifest, profiles);
  const byName = new Map(options.map((o) => [o.n, o]));

  note('ready');
  return { manifest, options, byName, profiles, fromCache };
}

export function loadDocs(hash: string): Promise<Docs> {
  return cached<Docs>('docs.json', hash);
}

export async function cacheStats(): Promise<{ entries: string[] }> {
  const keys = (await idbKeys()) ?? [];
  return { entries: keys.map(String) };
}

export const clearCache = idbClear;
