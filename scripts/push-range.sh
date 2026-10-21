#!/bin/sh
# Prints the git range of commits that are new in this GitHub Actions push or pull request.
# Needs a full clone (actions/checkout with fetch-depth: 0).
set -eu

if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
  echo "$PR_BASE..$PR_HEAD"
elif [ -n "${BEFORE:-}" ] && ! echo "$BEFORE" | grep -qE '^0+$' && git cat-file -e "$BEFORE^{commit}" 2>/dev/null; then
  echo "$BEFORE..$GITHUB_SHA"
else
  # New branch, or a force-push whose old tip is gone: what isn't on the default branch yet.
  echo "origin/$DEFAULT_BRANCH..$GITHUB_SHA"
fi
