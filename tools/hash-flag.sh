#!/usr/bin/env bash
# Generate the expected_sha256 for a flag or expected command output.
# Usage: ./tools/hash-flag.sh 'SQ{my-flag-text}'
set -euo pipefail
[ $# -eq 1 ] || { echo "usage: $0 'flag-text'" >&2; exit 1; }
printf '%s' "$1" | sha256sum | cut -d' ' -f1
