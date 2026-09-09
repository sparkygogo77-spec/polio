#!/usr/bin/env bash
#
# Before each turn: fetch the remote and say where this branch stands against
# every branch that has work this one does not.
#
# Several sessions work this repository at once, each on its own branch, so a
# branch can fall behind between one prompt and the next — behind the default
# branch, and behind a sibling that touched the same files. Fetching is
# read-only and cannot lose work; deciding whether to merge is left to the
# session, which knows what is half-finished. Any failure here is silent — a
# branch check must never be the reason a turn does not start.
#
# The same check is owed again by hand before every commit: the rule in
# AGENTS.md §11 and docs/DESIGN.md §4.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

# Everything the remote has, branches gone included.
git fetch --quiet --prune origin >/dev/null 2>&1 || exit 0

# The default branch, asked of the remote rather than assumed.
ref=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
if [ -z "${ref:-}" ]; then
  git remote set-head origin -a >/dev/null 2>&1
  ref=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
fi

here=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ "$here" = "HEAD" ] && exit 0

lines=""
if [ -n "${ref:-}" ]; then
  behind=$(git rev-list --count "HEAD..$ref" 2>/dev/null) || behind=0
  ahead=$(git rev-list --count "$ref..HEAD" 2>/dev/null) || ahead=0
  if [ "$here" = "${ref#origin/}" ]; then
    lines="On the default branch ($here): $behind behind and $ahead ahead of $ref."
  else
    lines="$here is $behind behind and $ahead ahead of the default branch $ref."
  fi
fi

# Every other branch that has commits this one lacks, newest work named.
moved=""
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin 2>/dev/null); do
  case "$b" in origin|origin/HEAD|"$ref"|"origin/$here") continue ;; esac
  n=$(git rev-list --count "HEAD..$b" 2>/dev/null) || continue
  [ "$n" -gt 0 ] || continue
  subjects=$(git log --format='%s' -3 "HEAD..$b" 2>/dev/null | sed 's/^/    - /')
  moved="$moved
  $b has $n commit(s) this branch does not:
$subjects"
done

if [ -n "$moved" ]; then
  note="Branch check: $lines
Other branches with work not here:$moved
Read what arrived and merge what relates before changing shared files — and again before every commit."
elif [ -n "$lines" ]; then
  note="Branch check: $lines No other branch has work this one lacks."
else
  note="Branch check: no other branch has work this one lacks."
fi

jq -nc --arg c "$note" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$c}}'
