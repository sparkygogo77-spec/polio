#!/usr/bin/env bash
#
# Before each turn: fetch the repository's default branch and say where this
# branch stands against it.
#
# Several sessions work this repository at once, so a branch can fall behind
# between one prompt and the next. Fetching is read-only and cannot lose work;
# deciding whether to merge is left to the session, which knows what is
# half-finished. Any failure here is silent — a branch check must never be the
# reason a turn does not start.
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

# The default branch, asked of the remote rather than assumed.
ref=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
if [ -z "${ref:-}" ]; then
  git remote set-head origin -a >/dev/null 2>&1
  ref=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
fi
[ -n "${ref:-}" ] || exit 0

git fetch --quiet origin "${ref#origin/}" >/dev/null 2>&1 || exit 0

here=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ "$here" = "HEAD" ] && exit 0
behind=$(git rev-list --count "HEAD..$ref" 2>/dev/null) || exit 0
ahead=$(git rev-list --count "$ref..HEAD" 2>/dev/null) || ahead=0

if [ "$here" = "${ref#origin/}" ]; then
  note="Branch check: on the default branch ($here), $behind behind and $ahead ahead of $ref."
elif [ "$behind" -gt 0 ]; then
  subjects=$(git log --format='%s' -3 "HEAD..$ref" 2>/dev/null | sed 's/^/  - /')
  note="Branch check: $here is $behind commit(s) behind $ref and $ahead ahead.
Newest work on the default branch:
$subjects
Merge $ref before changing shared files, and write the change to fit what is already there."
else
  note="Branch check: $here is current with $ref ($ahead ahead)."
fi

jq -nc --arg c "$note" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$c}}'
