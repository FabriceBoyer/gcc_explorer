#!/bin/sh
# ---------------------------------------------------------------------------
# Runs INSIDE an official `gcc:<major>` container.
#
# Dumps everything the GCC driver itself is willing to tell us about its
# options, so that the whole dataset of GCC Explorer is derived from GCC and
# nothing else (no scraping, no third party lists).
#
#   /out/meta.txt              versions / target triple / configure line
#   /out/help/<class>.txt      `gcc --help=<class>`            (descriptions)
#   /out/help/<class>.undoc.txt`gcc --help=<class>,undocumented`
#   /out/state/<driver>/<class>.txt  `<driver> -Q --help=<class>`  (defaults)
#   /out/packs/<driver>__<id>/<class>.txt  same, with an umbrella flag on
#   /out/man/gcc.1             the installed troff man page
#   /out/samples/<name>.txt    real diagnostics produced by sample programs
# ---------------------------------------------------------------------------
set -eu

OUT=${OUT:-/out}
# A very wide terminal makes GCC emit one line per option instead of wrapping
# its descriptions, which makes the help output trivially parseable.
COLUMNS=10000
export COLUMNS

mkdir -p "$OUT/help" "$OUT/state" "$OUT/packs" "$OUT/man" "$OUT/samples"

# --- identity ---------------------------------------------------------------
{
  echo "version=$(gcc -dumpversion)"
  echo "fullversion=$(gcc -dumpfullversion 2>/dev/null || gcc -dumpversion)"
  echo "banner=$(gcc --version | head -1)"
  echo "target=$(gcc -dumpmachine)"
  echo "date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$OUT/meta.txt"
gcc -v > "$OUT/verbose.txt" 2>&1 || true

# --- option descriptions, per class ----------------------------------------
# `common`/`optimizers`/`warnings`/`target`/`params` are option *classes*;
# `c`, `c++`, ... are language filters. Failures are tolerated because not
# every front end is installed in every image.
CLASSES="common optimizers warnings target params"
LANGS="c c++ objc objc++ fortran ada go d"

for cls in $CLASSES $LANGS; do
  safe=$(echo "$cls" | tr '+' 'p')
  gcc "--help=$cls"              > "$OUT/help/$safe.txt"       2>/dev/null || rm -f "$OUT/help/$safe.txt"
  gcc "--help=$cls,undocumented" > "$OUT/help/$safe.undoc.txt" 2>/dev/null || rm -f "$OUT/help/$safe.undoc.txt"
done

# --- default values (-Q), per driver ---------------------------------------
# NOTE: `--help=a,b` *intersects* the classes, it does not union them, so each
# class has to be queried on its own.
QCLASSES="common optimizers warnings target params"

dump_state() {
  driver=$1; dir=$2; shift 2
  mkdir -p "$dir"
  for cls in $QCLASSES; do
    # shellcheck disable=SC2086
    if "$driver" "$@" -Q "--help=$cls" > "$dir/$cls.txt" 2>/dev/null; then
      :
    else
      rm -f "$dir/$cls.txt"
    fi
  done
}

for driver in gcc g++; do
  command -v "$driver" >/dev/null 2>&1 || continue
  dump_state "$driver" "$OUT/state/$driver"
done

# --- umbrella / "pack" options ---------------------------------------------
# Every entry is `id|flags`. Diffing these dumps against the baseline state
# tells us exactly which options each umbrella flag turns on.
PACKS='
Wall|-Wall
Wextra|-Wextra
Wall -Wextra|-Wall -Wextra
Wpedantic|-Wpedantic
Wformat=2|-Wformat=2
Wunused|-Wunused
Wconversion|-Wconversion
O1|-O1
O2|-O2
O3|-O3
Os|-Os
Oz|-Oz
Ofast|-Ofast
Og|-Og
ffast-math|-ffast-math
fanalyzer|-fanalyzer
fsanitize=address|-fsanitize=address
fsanitize=undefined|-fsanitize=undefined
fstack-protector-strong|-fstack-protector-strong
fhardened|-fhardened
'

echo "$PACKS" | while IFS='|' read -r id flags; do
  [ -n "${id:-}" ] || continue
  # `/` and spaces are not welcome in directory names
  safe=$(echo "$id" | tr ' /' '__')
  for driver in gcc g++; do
    command -v "$driver" >/dev/null 2>&1 || continue
    # A pack that this release does not know about must not produce a dump.
    # shellcheck disable=SC2086
    if "$driver" $flags -Q --help=common >/dev/null 2>&1; then
      # shellcheck disable=SC2086
      dump_state "$driver" "$OUT/packs/${driver}__${safe}" $flags
      # Keep only the classes the umbrella flag actually changes: the raw
      # dumps live in git, no point in storing 20 identical copies.
      for cls in $QCLASSES; do
        a="$OUT/state/$driver/$cls.txt"
        b="$OUT/packs/${driver}__${safe}/$cls.txt"
        [ -f "$b" ] || continue
        if [ -f "$a" ] && cmp -s "$a" "$b"; then rm -f "$b"; fi
      done
      if [ -n "$(ls -A "$OUT/packs/${driver}__${safe}" 2>/dev/null)" ]; then
        printf '%s\n' "$flags" > "$OUT/packs/${driver}__${safe}/FLAGS"
      else
        rmdir "$OUT/packs/${driver}__${safe}"
      fi
    fi
  done
done

# --- the man page -----------------------------------------------------------
for d in /usr/local/share/man/man1 /usr/share/man/man1; do
  [ -f "$d/gcc.1" ] && cp "$d/gcc.1" "$OUT/man/gcc.1" && break
done

# --- real diagnostics for sample programs ----------------------------------
# Each sample declares the flags it needs on a `// FLAGS:` line.
if [ -d /samples ]; then
  for f in /samples/*.c /samples/*.cc; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    flags=$(sed -n 's|^// *FLAGS: *||p' "$f" | head -1)
    case "$f" in *.cc) drv=g++ ;; *) drv=gcc ;; esac
    command -v "$drv" >/dev/null 2>&1 || continue
    # shellcheck disable=SC2086
    "$drv" $flags -fdiagnostics-color=never -c "$f" -o /tmp/sample.o \
      > "$OUT/samples/$name.txt" 2>&1 || true
    sed -i "s|/samples/||g" "$OUT/samples/$name.txt" 2>/dev/null || true
  done
fi

echo "extraction complete for $(gcc -dumpversion)"
