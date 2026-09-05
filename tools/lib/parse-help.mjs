/**
 * Parsers for the textual dumps produced by the GCC driver itself.
 *
 *   `gcc --help=<class>`      option name + one line description
 *   `gcc -Q --help=<class>`   option name + current value ("state")
 *
 * The extractor runs GCC with `COLUMNS=10000`, which makes it print exactly one
 * line per option instead of wrapping the description, so both formats are
 * strictly line based.
 */

/** Column (inside the line, minus the 2 space indent) where descriptions start. */
const DESC_COLUMN = 28;

/**
 * `gcc --help=<class>` -> Map<optionName, description>
 */
export function parseHelpDump(text) {
  const options = new Map();
  let last = null;

  for (const raw of text.split('\n')) {
    if (!raw.startsWith('  ')) { last = null; continue; }
    const body = raw.slice(2);
    if (!body.trim()) { last = null; continue; }

    // Continuation of a wrapped description.
    if (body.slice(0, DESC_COLUMN).trim() === '' && last) {
      options.set(last, `${options.get(last)} ${body.trim()}`.trim());
      continue;
    }

    let name;
    let desc;
    if (body.length <= DESC_COLUMN) {
      name = body.trim();
      desc = '';
    } else if (body[DESC_COLUMN - 1] === ' ') {
      name = body.slice(0, DESC_COLUMN).trim();
      desc = body.slice(DESC_COLUMN).trim();
    } else {
      const sp = body.indexOf(' ', DESC_COLUMN);
      if (sp < 0) { name = body.trim(); desc = ''; }
      else { name = body.slice(0, sp).trim(); desc = body.slice(sp).trim(); }
    }

    if (!name || !name.startsWith('-')) { last = null; continue; }
    // GCC repeats an option's own spelling at the head of some descriptions.
    if (desc.startsWith(name)) desc = desc.slice(name.length).trim();
    if (!options.has(name) || (!options.get(name) && desc)) options.set(name, desc);
    last = name;
  }
  return options;
}

/**
 * `gcc -Q --help=<class>` -> Map<optionName, value>
 *
 * Values look like `[enabled]`, `[disabled]`, `2`, `none`, or are empty for
 * options that carry no state. GCC 8/9 print `--help=params` in a different,
 * space separated shape (`name  default 2 minimum 0 maximum 50`), which is
 * normalised here to the modern `--param=name=` spelling.
 */
export function parseStateDump(text, { params = false } = {}) {
  const state = new Map();

  for (const raw of text.split('\n')) {
    if (!raw.startsWith('  ')) continue;
    const body = raw.slice(2);
    if (!body.trim()) continue;

    if (body.includes('\t')) {
      const [head, ...rest] = body.split('\t');
      const name = head.trim();
      if (!name.startsWith('-')) continue;
      state.set(name, rest.join(' ').trim());
      continue;
    }

    if (params) {
      const m = /^(\S+)\s+default\s+(\S+)(?:\s+minimum\s+(\S+))?(?:\s+maximum\s+(\S+))?/.exec(body.trim());
      if (m) {
        state.set(`--param=${m[1]}=`, m[2]);
        continue;
      }
    }

    const name = body.trim().split(/\s{2,}/)[0];
    if (name.startsWith('-')) state.set(name, '');
  }
  return state;
}

/**
 * GCC 8/9 list parameters as `name  default X minimum Y maximum Z`; extract the
 * bounds so the UI can show them.
 */
export function parseLegacyParams(text) {
  const params = new Map();
  for (const raw of text.split('\n')) {
    const m = /^\s+(\S+)\s+default\s+(\S+)(?:\s+minimum\s+(\S+))?(?:\s+maximum\s+(\S+))?\s*$/.exec(raw);
    if (m) params.set(`--param=${m[1]}=`, { default: m[2], min: m[3], max: m[4] });
  }
  return params;
}
