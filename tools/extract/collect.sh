#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Host side driver: runs tools/extract/in-container.sh inside one official
# `gcc:<major>` container per supported release and stores the raw dumps under
# data/raw/<major>/. Those dumps are committed to git so that the dataset can
# be rebuilt (tools/build-dataset.mjs) without Docker.
#
#   ./tools/extract/collect.sh            # all supported versions
#   ./tools/extract/collect.sh 12 13      # only those
#   ENGINE=podman ./tools/extract/collect.sh
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENGINE=${ENGINE:-docker}
IMAGE_PREFIX=${IMAGE_PREFIX:-gcc}
DEFAULT_VERSIONS="8 9 10 11 12 13 14 15"
VERSIONS=${*:-$DEFAULT_VERSIONS}

command -v "$ENGINE" >/dev/null 2>&1 || {
  echo "error: '$ENGINE' not found. Install Docker (or set ENGINE=podman)." >&2
  exit 1
}

for v in $VERSIONS; do
  image="$IMAGE_PREFIX:$v"
  out="$ROOT/data/raw/$v"
  echo "==> $image"

  if ! "$ENGINE" image inspect "$image" >/dev/null 2>&1; then
    echo "    pulling $image ..."
    "$ENGINE" pull -q "$image"
  fi

  rm -rf "$out"
  mkdir -p "$out"

  "$ENGINE" run --rm \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -v "$ROOT/tools/extract/in-container.sh:/extract.sh:ro" \
    -v "$ROOT/tools/extract/samples:/samples:ro" \
    -v "$ROOT/tools/extract/bench:/bench:ro" \
    -v "$out:/out" \
    "$image" /bin/sh /extract.sh

  echo "    -> data/raw/$v ($(du -sh "$out" | cut -f1))"
done

echo
echo "Raw dumps refreshed. Now run: npm run data:build"
