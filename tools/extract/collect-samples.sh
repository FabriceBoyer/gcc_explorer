#!/usr/bin/env bash
# Refresh diagnostics without recollecting help, manuals or benchmarks.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
for v in ${*:-8 9 10 11 12 13 14 15}; do
  # Variables in the script are expanded inside the container.
  # shellcheck disable=SC2016
  docker run --rm --user "$(id -u):$(id -g)" \
    -v "$ROOT/tools/extract/samples:/samples:ro" \
    -v "$ROOT/data/raw/$v/samples:/out" "gcc:$v" sh -c '
      for f in /samples/*.c /samples/*.cc; do
        flags=$(sed -n "s|^// *FLAGS: *||p" "$f")
        case "$f" in *.cc) drv=g++ ;; *) drv=gcc ;; esac
        "$drv" $flags -fdiagnostics-color=never -c "$f" -o /tmp/sample.o > "/out/$(basename "$f").txt" 2>&1 || true
        sed -i "s|/samples/||g" "/out/$(basename "$f").txt"
      done'
  echo "GCC $v diagnostics refreshed"
done
