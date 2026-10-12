#!/bin/bash
# FS wave F QA (reused from qa_logs_E): the full unit suite, one file per vitest process, in N lanes (default 2; the container has 4 CPUs).
# usage (from anywhere): docs/kafaa/ref/qa_logs_E/unit_lanes.sh [lanes] [file-filter-regex]
# Logs: $OUT/lane<k>.log (one line per file: PASS/FAIL, tests, seconds) and $OUT/<file>.log for failures. TMPDIR is per lane under /dev/shm.
set -u
LANES=${1:-2}
FILTER=${2:-.}
APP=/workspace/nexus/kafaa
OUT=${OUT:-/dev/shm/qaF/unit}
mkdir -p "$OUT"
cd "$APP" || exit 1
mapfile -t FILES < <(ls tests/unit/*.test.ts tests/unit/*.test.tsx | grep -E "$FILTER" | sort)
echo "files: ${#FILES[@]} lanes: $LANES out: $OUT"
run_lane() {
  local k=$1; local tmp=/dev/shm/vt-lane$k; mkdir -p "$tmp"
  : > "$OUT/lane$k.log"
  for ((i = k; i < ${#FILES[@]}; i += LANES)); do
    local f=${FILES[$i]}; local b=$(basename "$f"); local t0=$(date +%s)
    TMPDIR=$tmp timeout 1500 npx vitest run --maxWorkers=1 --minWorkers=1 "$f" > "$OUT/$b.log" 2>&1
    local rc=$?; local dt=$(( $(date +%s) - t0 ))
    local sum=$(grep -E "^ +Tests " "$OUT/$b.log" | tail -1 | sed 's/  */ /g')
    if [ $rc -eq 0 ]; then echo "PASS $b ($sum) ${dt}s" >> "$OUT/lane$k.log"; rm -f "$OUT/$b.log"; else echo "FAIL $b rc=$rc ($sum) ${dt}s" >> "$OUT/lane$k.log"; fi
    rm -rf "$tmp"/* 2>/dev/null
  done
  echo "DONE" >> "$OUT/lane$k.log"
}
for ((k = 0; k < LANES; k++)); do run_lane $k & done
wait
cat "$OUT"/lane*.log | grep -E "^(PASS|FAIL)" | sort -k2 > "$OUT/summary.txt"
echo "pass: $(grep -c ^PASS "$OUT/summary.txt") fail: $(grep -c ^FAIL "$OUT/summary.txt")"
grep ^FAIL "$OUT/summary.txt"
