#!/usr/bin/env bash
# The examples under backend/ and frontend/ are generated from template/. This fails when an
# example was edited by hand (fix it in template/ and re-render) or holds a nested git repo.
set -euo pipefail
cd "$(dirname "$0")/.."

KIT="template/backend/{% if has_kit_source %}packages{% endif %}/platform-kit"
IGNORE=(-x __pycache__ -x '*.egg-info' -x .pytest_cache -x .ruff_cache -x .venv -x .env
  -x node_modules -x dist -x '*.tsbuildinfo' -x test-results -x playwright-report
  -x uv.lock -x pnpm-lock.yaml -x .copier-answers.yml)
status=0
fail() { echo "::error::$1"; status=1; }

nested=$(find backend frontend -mindepth 2 -name .git -prune -print)
[ -z "$nested" ] || fail "nested git repositories (examples must be plain folders): $nested"

for example in mono-monolith mono-micro-kafka-nx mono-micro-moon poly-kit; do
  # Repo-manager files (Nx project.json, moon.yml) are rendered per example from *.jinja.
  diff -rq "${IGNORE[@]}" -x '*.jinja' -x project.json -x moon.yml "$KIT" "backend/$example/packages/platform-kit" \
    || fail "backend/$example/packages/platform-kit differs from the template kit"
done

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
render() { uvx copier copy --trust --defaults --skip-tasks --quiet "$@" template "$tmp/out"; }

render --data stack=frontend --data project_name="Web SPA" --data project_slug=web-spa \
  --data auth_mode=saas --data default_locale=en
# apps/web/public holds the generated MSW worker (pnpm mocks:init).
diff -rq "${IGNORE[@]}" -x public "$tmp/out" frontend/web-spa \
  || fail "frontend/web-spa differs from template/frontend"

rm -rf "$tmp/out"
render --data stack=backend --data project_name="My Platform" --data project_slug=my-platform \
  --data repo_layout=monorepo --data architecture=monolith --data messaging=none \
  --data repo_manager=none --data platform_profile=saas --data first_service=core-api
# services/ and the per-service database list are written by `dx new-service` / `dx new-saas`.
diff -rq "${IGNORE[@]}" -x services -x init "$tmp/out" backend/mono-monolith \
  || fail "backend/mono-monolith differs from template/backend"

exit "$status"
