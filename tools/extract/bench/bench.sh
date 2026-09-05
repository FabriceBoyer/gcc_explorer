#!/bin/sh
# ---------------------------------------------------------------------------
# Measures what a flag actually costs, inside the release's own container.
#
# For every flag in the list below we record, relative to the same build
# without it:
#
#   * compile time   (fastest of $BUILD_REPS compiles of bench/codegen.c)
#   * binary size    (bytes of the linked benchmark — fully deterministic)
#   * runtime        (fastest of $RUN_REPS runs of bench/runtime.c)
#
# Two things keep the numbers honest on a machine that is not a quiet lab:
#
#   * PAIRED measurement. The baseline is re-measured immediately before every
#     flag rather than once at the start, so a machine that slowly gets busier
#     over the run cannot masquerade as a flag that costs something. Each row
#     therefore carries its own baseline.
#   * The FASTEST run is kept, never the mean: background load can only ever
#     inflate a timing, so the minimum is the observation closest to the truth.
#
# Runtime is still wall clock on one machine. Read it as an order of magnitude.
#
# Baseline is `-O2`, i.e. we measure the *marginal* cost of adding the flag to
# a normal release build. For the `-O<n>` family the flag simply overrides the
# baseline, which makes `-O3` vs `-O2` exactly the comparison people want.
#
# Output: /out/bench/results.tsv
#   flag <TAB> status <TAB> build_ns <TAB> size_bytes <TAB> run_ns
#        <TAB> base_build_ns <TAB> base_size <TAB> base_run_ns
# ---------------------------------------------------------------------------
set -u

OUT=${OUT:-/out}
BENCH=${BENCH:-/bench}
BASE=${BASE:--O2}
BUILD_REPS=${BUILD_REPS:-3}
RUN_REPS=${RUN_REPS:-5}
BUILD_TIMEOUT=${BUILD_TIMEOUT:-180}

mkdir -p "$OUT/bench"
RESULTS="$OUT/bench/results.tsv"
: > "$RESULTS"

now_ns() { date +%s%N; }

# Smallest of the whitespace separated numbers on stdin.
#
# The minimum, not the mean or the median: a build or a run can only ever be
# made *slower* by unrelated load on the machine, so the fastest observation is
# the one closest to the flag's real cost.
best() {
  tr ' ' '\n' | grep -v '^$' | sort -n | head -1
}

# `timeout` is coreutils; every gcc image has it, but stay defensive.
if command -v timeout >/dev/null 2>&1; then
  RUN_LIMITED="timeout $BUILD_TIMEOUT"
else
  RUN_LIMITED=""
fi

# Times one configuration. Echoes "status build_ns size run_ns", or a status
# with empty fields when the release cannot build it.
run_one() {
  flags=$1

  # ---- compile time -------------------------------------------------------
  # One warm-up compile, discarded: it pays for the page cache and for any
  # lazily loaded part of the toolchain.
  # shellcheck disable=SC2086
  if ! $RUN_LIMITED gcc $BASE $flags -c "$BENCH/codegen.c" -o /tmp/codegen.o 2>/dev/null; then
    echo "build-failed   "
    return
  fi

  times=''
  i=0
  while [ "$i" -lt "$BUILD_REPS" ]; do
    start=$(now_ns)
    # shellcheck disable=SC2086
    $RUN_LIMITED gcc $BASE $flags -c "$BENCH/codegen.c" -o /tmp/codegen.o 2>/dev/null
    end=$(now_ns)
    times="$times $((end - start))"
    i=$((i + 1))
  done
  build_ns=$(echo "$times" | best)

  # ---- size + runtime -----------------------------------------------------
  # shellcheck disable=SC2086
  if ! $RUN_LIMITED gcc $BASE $flags "$BENCH/runtime.c" -o /tmp/runtime 2>/dev/null; then
    echo "link-failed $build_ns  "
    return
  fi
  size=$(wc -c < /tmp/runtime | tr -d ' ')

  # Warm-up run, discarded for the same reason as the compile above.
  $RUN_LIMITED /tmp/runtime > /dev/null 2>&1

  times=''
  i=0
  while [ "$i" -lt "$RUN_REPS" ]; do
    start=$(now_ns)
    if ! $RUN_LIMITED /tmp/runtime > /dev/null 2>&1; then
      echo "run-failed $build_ns $size "
      return
    fi
    end=$(now_ns)
    times="$times $((end - start))"
    i=$((i + 1))
  done
  echo "ok $build_ns $size $(echo "$times" | best)"
}

# Measures the baseline and the flag back to back, and records both.
measure() {
  flags=$1
  tag=$2

  set -- $(run_one "")
  base_status=$1; base_build=${2:-}; base_size=${3:-}; base_run=${4:-}
  if [ "$base_status" != ok ]; then
    printf '%s\tbaseline-failed\t\t\t\t\t\t\n' "$tag" >> "$RESULTS"
    return
  fi

  set -- $(run_one "$flags")
  status=$1; build=${2:-}; size=${3:-}; run=${4:-}

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$tag" "$status" "$build" "$size" "$run" "$base_build" "$base_size" "$base_run" >> "$RESULTS"
}

# A baseline-against-itself row: whatever spread it shows is pure measurement
# noise, and the UI uses it to say how much to trust the rest.
measure "" "__BASELINE__"

# One entry per line, `flags` verbatim. Anything the release does not support
# is recorded as build-failed and simply carries no measurement in the dataset.
FLAGS='
-O0
-O1
-O3
-Os
-Oz
-Ofast
-Og
-flto
-fno-inline
-funroll-loops
-fno-omit-frame-pointer
-g
-g3
-fstack-protector
-fstack-protector-strong
-fstack-protector-all
-fstack-clash-protection
-fcf-protection=full
-fPIE -pie
-ftrivial-auto-var-init=zero
-ftrivial-auto-var-init=pattern
-fzero-call-used-regs=used-gpr
-fzero-call-used-regs=all
-fstrict-flex-arrays=3
-D_FORTIFY_SOURCE=2
-D_FORTIFY_SOURCE=3
-fhardened
-fsanitize=address
-fsanitize=undefined
-fsanitize=address -fsanitize=undefined
-fsanitize=thread -fPIE -pie
-fsanitize=leak
-fanalyzer
--coverage
-pg
-fno-strict-aliasing
-fno-semantic-interposition
-fvisibility=hidden
-fno-common
-fexceptions
-Wall -Wextra
-Wall -Wextra -Wconversion -Wformat=2
'

echo "$FLAGS" | while read -r line; do
  [ -n "$line" ] || continue
  measure "$line" "$line"
done

echo "benchmarked $(wc -l < "$RESULTS") configurations"
