#!/bin/sh
# Logs start/end of every tsgolint launch, then runs the real binary.
now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }
echo "start $$ $(now) $*" >> "$TSGOLINT_LOG"
"$TSGOLINT_REAL" "$@"
rc=$?
echo "end $$ $(now)" >> "$TSGOLINT_LOG"
exit $rc
