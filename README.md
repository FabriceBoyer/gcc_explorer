# GCC Explorer

> Explore, compare and export every GCC compile and link option — GCC 8 through GCC 15.

A frontend-only web application that turns the sprawl of GCC's command line into
something you can actually search: **2 997 options**, **2 373 of them with their
full manual entry**, default values and availability for **eight releases**, the
exact membership of **19 umbrella flags** (`-Wall`, `-O2`, `-fanalyzer`, …), ten
curated hardening profiles, and one-click export to nine build systems.

There is no backend. The dataset is a handful of static JSON files that the
browser caches in IndexedDB, so after the first visit the whole catalogue works
offline.

**Every fact in it is produced by running GCC itself** — no scraping, no
hand-maintained lists.

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Running with Docker](#running-with-docker)
- [How the dataset is produced](#how-the-dataset-is-produced)
- [Regenerating the dataset](#regenerating-the-dataset)
- [Dataset format](#dataset-format)
- [Project layout](#project-layout)
- [Deployment](#deployment)
- [Continuous integration](#continuous-integration)
- [Design notes](#design-notes)
- [Known limits](#known-limits)
- [Licence](#licence)

---

## Features

### The table

One virtualised table over every option GCC knows about, with the option name,
its argument syntax, its **default value in the pivot release**, a one-line
description and the **release range** it exists in. Sortable on every column,
searchable with name-first ranking (typing `-Wsh` puts `-Wshadow` on top, not
some parameter whose help text mentions shadowing).

### Filtering

| Filter | What it does |
| --- | --- |
| **Releases** + `any of` / `all of` / `only in` | `only in` is how you find options unique to one release |
| **Pivot release** | Which release the *Default* column and the profile availability check use |
| **Default value** | on · off · takes a value |
| **Enabled by** | Restrict to the options an umbrella flag turns on |
| **Profiles** | Restrict to a curated flag set |
| **Categories** | The manual's own grouping — this is what separates compile options from link options |
| **Front ends** | C, C++, Objective-C, Fortran, Ada, Go, D |
| **Architecture** | 67 machine-option groups, as the GCC manual groups them |
| **Scope** | Cross-target machine options, undocumented options and aliases, hidden by default |

### Umbrella flags

`-Wall` does not enable the same set in GCC 9 and GCC 14. Rather than guessing,
the extractor dumps `gcc -Q --help=<class>` with and without each umbrella flag,
per release **and per driver** (`gcc` and `g++`), and records every option whose
state changed. The detail panel shows which releases are affected and whether
the effect was only observed under one front end.

Currently mapped: `-Wall`, `-Wextra`, `-Wall -Wextra`, `-Wpedantic`,
`-Wformat=2`, `-Wunused`, `-Wconversion`, `-O1`, `-O2`, `-O3`, `-Os`, `-Oz`,
`-Ofast`, `-Og`, `-ffast-math`, `-fanalyzer`, `-fsanitize=address`,
`-fsanitize=undefined`, `-fstack-protector-strong`.

### The detail panel

For the selected option: the **full `gcc.1` manual entry** rendered from troff,
per-release availability *and* default values side by side, alias resolution,
umbrella flag membership, profile membership with the rationale, and — for 32
common warnings — **the diagnostic GCC actually prints**, captured by compiling
a sample program in every release.

### Hardening profiles

Ten curated flag sets, each flag annotated with *why* it is there and checked
against the extracted data so a profile never suggests a flag your release does
not have:

| Profile | For |
| --- | --- |
| Hardening — Baseline | The OpenSSF baseline: mitigations every production build should carry |
| Hardening — Strict | Aggressive mitigations for code that parses untrusted input |
| Diagnostics — Recommended | Warnings that find bugs without drowning an existing codebase |
| Diagnostics — Zero Tolerance | `-Werror` plus the static analyzer, for new code and CI gates |
| Sanitizers — Address & UB | Instrumented build for test suites and fuzzing |
| Sanitizers — Threads | Data race detection |
| Embedded — Freestanding | Bare metal: stack discipline, deterministic size |
| Reproducible Builds | Byte-identical output regardless of path, host or clock |
| Release — Performance | Fast and still debuggable; no fast-math, no UB gambling |
| Debug — Developer Build | `-Og -g3`, libstdc++ assertions |

### Selection and export

Tick options as you go — the selection is stored in `localStorage`, so a refresh
never loses a recipe you have been assembling. *Select all* / *Deselect all*
apply to whatever the current filters show.

Export splits the flags into **compile** and **link** lists first, because
getting that split wrong is the usual reason a hardened build silently loses
half its mitigations (`-fsanitize=`, `-flto`, `-pie` and friends have to appear
on both command lines):

`Shell / CFLAGS` · `Make` · `CMake` · `Meson` · `Bazel` · `Autotools` · `Ninja` ·
`Ant (cpptasks)` · `compile_flags.txt` · `JSON`

The dialog also warns when a selected flag does not exist in the pivot release.

### What a flag costs

Two sortable columns, **Build** and **Runtime**, plus binary size in the detail
panel. Filterable from the sidebar by level (*improves · negligible · low ·
moderate · high · varies*), and by "only benchmarked options".

The score comes from one of three places, and the UI always says which:

| Source | How | Coverage |
| --- | --- | --- |
| **Measured** | 42 flags are compiled *and run* inside each release's own container, against a benchmark that exercises dense array arithmetic, pointer chasing, bounded string work, allocation churn and non-inlinable calls | the options those flags inform |
| **Curated** | costs that are established fact but that no single generic benchmark can show, hand-written with their reasoning in `tools/data/impact.json` | ~1 800 options |
| **Derived** | what the option's category makes certain — a pure diagnostic cannot change generated code, so its runtime cost is exactly zero | the rest |

Four things keep the measurement from lying:

- **Paired baselines.** The reference build is re-measured immediately before
  every flag, never once at the start, so a machine that gets busier during the
  run cannot masquerade as a flag that costs something.
- **Fastest run wins.** Background load can only inflate a timing, so the
  minimum of several runs is the observation closest to the truth; each is
  preceded by a discarded warm-up.
- **Median across the eight releases**, so one noisy run cannot decide a rating.
- **A baseline measured against itself** is recorded on every release. It lands
  within ~1% on build and runtime, and the bands separating *negligible* from
  *low* sit well outside that.

A curated statement **beats** a measurement on the axis it covers. Wall-clock
timing on a shared machine will occasionally claim that adding a warning made
the program faster, and publishing that is worse than publishing nothing.

Binary size is exact — a byte count, not a stopwatch. Build time is stable to a
few percent. **Runtime is wall clock on one developer machine**: treat 2× as
meaningful and 5% as noise.

### Compare releases

A dedicated diff view: which options were **added**, **removed**, or had their
**default value changed** between any two of the eight releases.

### Elsewhere

Light and dark themes, keyboard navigation (`/` to search, `Esc` to close),
adjustable row density, and a fully responsive layout down to phone width.

---

## Quick start

Requires **Node.js 20+**.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. The dataset under `public/data/` is committed
to the repository, so there is nothing else to generate before the app works.

### All scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Typecheck and produce `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the app and the tooling |
| `npm run data:collect` | Re-run the extraction in the `gcc:*` containers (needs Docker) |
| `npm run data:build` | Rebuild `public/data/` from `data/raw/` (no Docker needed) |
| `npm run data:all` | Both of the above |

Set `BASE_PATH` when the site is not served from the domain root:

```bash
BASE_PATH=/gcc_explorer/ npm run build
```

---

## Running with Docker

```bash
docker compose up --build
```

The production image (multi-stage build → unprivileged nginx) is then on
<http://localhost:8080>. Override the port with `GCCX_PORT`.

For a containerised dev server with hot reload:

```bash
docker compose --profile dev up
```

…on <http://localhost:5173> (`GCCX_DEV_PORT`).

The runtime container runs read-only, without privilege escalation, and exposes
`/healthz`. Building the image never needs Docker-in-Docker or a compiler — the
dataset is already in the repository.

---

## How the dataset is produced

Everything is derived from GCC. For each major release 8 → 15, one official
[`gcc:<major>`](https://hub.docker.com/_/gcc) container is started and
`tools/extract/in-container.sh` runs inside it:

1. **Option names and descriptions** — `gcc --help=<class>` for each of
   `common`, `optimizers`, `warnings`, `target`, `params`, plus the same with
   `,undocumented`, plus one dump per front end (`c`, `c++`, `objc`, `objc++`,
   `fortran`, `ada`, `go`, `d`).

   The extractor sets `COLUMNS=10000` so GCC prints one line per option instead
   of wrapping its descriptions, which makes the output trivially parseable.

   > `--help=a,b` **intersects** the two classes, it does not union them, so
   > each class has to be queried on its own. This is not obvious and it is why
   > `--help=common,warnings` returns nothing.

2. **Default values** — `gcc -Q --help=<class>`, for both the `gcc` and the
   `g++` driver. This is also where aliases surface (`-W` reports `-Wextra`)
   and where options rejected by a front end show up as `[available in …]`.

3. **Umbrella flags** — the same `-Q` dumps, re-run once per umbrella flag.
   Class dumps identical to the baseline are deleted, so what lands in git is
   only what the flag actually changes.

4. **The manual** — the installed `/usr/local/share/man/man1/gcc.1` is copied
   out and parsed by `tools/lib/roff.mjs`, a small parser for the `pod2man`
   subset of troff. Each `.IP` entry becomes Markdown, and the enclosing
   `.SS` / `.IX Subsection` gives its manual section — which is what tells
   "Options for Linking" from "Options That Control Optimization".

5. **Real diagnostics** — the 32 sample programs in `tools/extract/samples/`
   are compiled with the flags declared on their `// FLAGS:` line and the
   compiler's output is captured verbatim, per release.

6. **What each flag costs** — `tools/extract/bench/` compiles a
   compile-heavy translation unit and builds and runs a mixed-workload
   benchmark, once per flag and once for a baseline taken immediately before
   it, recording build time, binary size and runtime.

The raw dumps land in `data/raw/<major>/` and are **committed**.
`tools/build-dataset.mjs` then merges them into `public/data/` — no Docker
required for that step, which is what lets CI verify the dataset without ever
running a compiler.

---

## Regenerating the dataset

```bash
# ~4 minutes and ~14 GB of images the first time
./tools/extract/collect.sh

# or a single release
./tools/extract/collect.sh 15

# merge the raw dumps into public/data/
npm run data:build
```

`ENGINE=podman ./tools/extract/collect.sh` works too, and `IMAGE_PREFIX`
lets you point at a mirror.

Benchmarking is the slow part — about seven minutes per release, and it wants a
quiet machine. Set `SKIP_BENCH=1` to leave it out.

To add an umbrella flag, add a line to the `PACKS` list in
`tools/extract/in-container.sh`. To benchmark another flag, add it to the
`FLAGS` list in `tools/extract/bench/bench.sh` and map it to the options it
informs under `benchTargets` in `tools/data/impact.json`. To add a diagnostic example, drop a `.c` or
`.cc` file into `tools/extract/samples/` with a `// FLAGS:` first line — it is
wired up automatically, and attached to every option named on that line.
Curated profiles live in `tools/data/profiles.json`.

The build honours `SOURCE_DATE_EPOCH`, so the output is reproducible.

---

## Dataset format

`public/data/` holds four files:

| File | Size | Contents |
| --- | ---: | --- |
| `manifest.json` | ~4 KB | Releases, umbrella flags, categories, counts, and the content hash the cache is keyed on. Always revalidated against the network. |
| `options.json` | ~665 KB | One compact record per option. |
| `docs.json` | ~1.3 MB | Manual text and diagnostic samples. Fetched lazily, on first use. |
| `profiles.json` | ~27 KB | The curated profiles, with availability resolved per release. |

Option records use short keys to keep the payload small:

```jsonc
{
  "n": "-Wuse-after-free",          // canonical name
  "c": "warnings",                  // category
  "m": 240,                         // bit mask of releases: bit i = versions[i]
  "d": "Warn for uses of pointers to deallocated storage.",
  "v": "disabled",                  // default: a string when uniform,
                                    // otherwise an array aligned on versions[]
  "vx": …,                          // default under g++, when it differs
  "k": ["common", "warnings"],      // --help classes
  "s": "Options to Request or Suppress Warnings",   // manual section
  "doc": 1,                         // has an entry in docs.json
  "pk": {                           // umbrella flags that turn it on
    "-Wall": { "m": 240, "v": "enabled", "l": ["C", "C++"] }
  },
  "ex": ["Wuse-after-free"]         // ids of diagnostic samples
}
```

`m` is a bit mask over `manifest.versions`: bit *i* means the option exists in
`versions[i]`. With eight releases the whole availability vector is one small
integer.

### Caching

`manifest.json` is small and always revalidated (`cache: 'no-cache'`); it
carries a content hash. The large payloads are stored in IndexedDB under
`<file>@<hash>`, so a repeat visit is a single 4 KB request and everything else
comes from disk. Entries from an older build are pruned automatically, and
there is a *Clear the browser cache* button on the Docs page. When the network
is unavailable the app falls back to whatever is cached.

---

## Project layout

```
.
├── src/
│   ├── lib/
│   │   ├── dataset.ts          fetch + IndexedDB caching, version bit helpers
│   │   ├── dataset-context.tsx React context, lazy loading of docs.json
│   │   ├── store.ts            Zustand state; selection and prefs persisted
│   │   ├── filters.ts          filtering, search ranking, default lookup
│   │   ├── export.ts           the nine build-system exporters
│   │   ├── catalog.ts          category metadata and colours
│   │   └── markdown.ts         marked + DOMPurify
│   ├── components/             table, sidebar, detail panel, export dialog
│   └── pages/                  Home · Explorer · Compare · Docs
├── tools/
│   ├── extract/
│   │   ├── collect.sh          host driver: one container per release
│   │   ├── in-container.sh     everything that runs inside gcc:<major>
│   │   ├── samples/            32 sample programs with a // FLAGS: line
│   │   └── bench/              compile-time and runtime benchmarks
│   ├── lib/
│   │   ├── roff.mjs            the gcc.1 troff parser
│   │   ├── parse-help.mjs      parsers for --help and -Q --help output
│   │   └── impact.mjs          measured/curated/derived cost resolution
│   ├── data/profiles.json      curated flag sets (hand written)
│   ├── data/impact.json        cost rules, thresholds, bench→option mapping
│   └── build-dataset.mjs       merges data/raw → public/data
├── data/raw/<major>/           committed raw dumps, one directory per release
├── public/data/                the generated dataset served to the browser
├── docker/nginx.conf
├── Dockerfile · docker-compose.yml
└── .github/workflows/          ci.yml · pages.yml
```

---

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/pages.yml`. The workflow resolves the correct asset base
automatically — `/<repo>/` for a project site, `/` for a
`<login>.github.io` user site — so no configuration is needed.

Enable it once under **Settings → Pages → Source → GitHub Actions**.

Routing uses hash URLs (`#/explorer`), which keeps deep links working on Pages
without a server-side rewrite rule.

Any static host works just as well: `npm run build` and serve `dist/`.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

- **build** — ESLint, `tsc -b`, `vite build`, and uploads `dist/`
- **dataset** — re-derives `public/data/` from the committed `data/raw/` with
  `SOURCE_DATE_EPOCH=0` and fails if the result differs from what is committed.
  This catches a dataset that was edited by hand or a parser change that was not
  followed by a rebuild — without CI ever running a compiler.
- **shell** — `shellcheck` over the extraction scripts
- **docker** — builds the runtime image and smoke tests the container

---

## Design notes

A few decisions worth knowing about if you work on this:

- **The manual is the source of categories.** `gcc --help` has no notion of
  "this is a link option". The `.SS` sections of `gcc.1` do, so the manual
  section is what drives the compile/link/preprocess split, with a name-based
  fallback for the few options the manual does not cover.
- **Options that `--help` never lists.** Driver-level options (`-L`, `-l`,
  `-Wl,`, `-shared`, `-D`) and options for other architectures do not appear in
  any `--help=<class>` dump. They are recovered from the manual and tagged
  `"src": "man"`, which is why the catalogue has 2 997 entries and not 1 626.
- **Bit masks over arrays.** Availability and umbrella membership are integers,
  not arrays of version numbers. It keeps `options.json` under 700 KB and makes
  every filter a bitwise test.
- **`overflow-clip`, not `overflow-hidden`,** on the app shell: an element with
  hidden overflow can still be scrolled programmatically by `scrollIntoView`,
  which silently shifts the whole layout out of view with no way back.
- **The selection is keyed by the full flag,** not by the option name — that is
  what keeps `-Wl,-z,relro` and `-Wl,-z,now` as two separate entries instead of
  one overwriting the other.

---

## Known limits

- The extraction runs on **x86-64 Linux**, so the default values and the
  machine options reported by `--help=target` are the x86-64 ones. Options for
  other architectures are still catalogued — they come from the manual — but
  they carry no default value.
- Umbrella flag membership is measured with the `gcc` and `g++` drivers. A flag
  that behaves differently under `gfortran` or `gccgo` is not covered.
- Manual entries are matched to `--help` names by canonicalising both sides
  (`-flto[=n]` → `-flto`, `-mabi=name` → `-mabi=`). A handful of exotic
  spellings end up without manual text; the detail panel says so rather than
  showing something wrong.
- Only major releases are covered. Point releases within a major line rarely
  add or remove options, but they do occasionally change a default.
- **Runtime impact is measured on one machine, on one benchmark**, much of
  whose time is spent inside libc. That makes it sharp at separating
  instrumentation overhead (ASan+UBSan measures at 4.8×) and blunt at
  separating optimisation levels — which is why the `-O` family is scored from
  a curated verdict rather than from the stopwatch. It is not a substitute for
  profiling your own workload. Options whose effect depends entirely on the
  code being compiled — `--param`, the individual optimisation passes,
  `-march=` — are reported as *varies* rather than given a number.

---

## Licence

The application is MIT licensed — see [LICENSE](LICENSE).

The option descriptions and manual text it displays are extracted from GCC,
copyright © Free Software Foundation, Inc. GCC is distributed under the GPL v3
or later with the GCC Runtime Library Exception; the GCC manual is distributed
under the GNU Free Documentation License v1.3. This project is not affiliated
with or endorsed by the FSF or the GCC project.


## Selection explained

Open **Selection** in the navigation or **Explain** in the selection bar to read a report of your saved flags. Choose GCC 8–15 and C/C++, search the report, and toggle baseline-enabled options, observed umbrella effects, full manual text and diagnostic examples. Explicit unsupported flags remain visible with a warning. Multiple arguments of one option remain separate. Defaults and pack effects are reference observations, not a command-line simulator. The source release of each manual entry is shown; it can differ from the selected GCC version.

Download **HTML** for a standalone, printable document (no external assets or scripts), or **Markdown** for version control and reviews. Both exports include every displayed entry, the compiler context and the current documentation settings. These exports are explanatory reports; build-system snippets remain available in Explorer. Showing baseline or umbrella entries does not add them to the saved selection.
