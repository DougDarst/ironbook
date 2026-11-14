#!/usr/bin/env bash
# Deploys the app to the server: builds the frontend, uploads pb_public,
# pb_hooks and pb_migrations, restarts the service, and checks it's healthy.
#
#   npm run deploy                 # deploy main
#   npm run deploy -- --dry-run    # show what would change; no upload, no restart
#   npm run deploy -- --allow-branch   # deliberately deploy the current branch
#
# Settings come from .env (git-ignored; see .env.example): DEPLOY_HOST,
# DEPLOY_PATH, DEPLOY_SERVICE, DEPLOY_PORT.
#
# It NEVER uploads, overwrites or deletes pb_data (the live database), and
# refuses to run if asked to. Before uploading anything it checks that the
# working tree is clean, that it's deploying main in sync with origin/main
# (unless --allow-branch), and that the server runs the pinned PocketBase.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/.env}"
UPLOAD=(pb_public pb_hooks pb_migrations)

fail() { echo "deploy: $*" >&2; exit 1; }
refuse() { echo "deploy: REFUSED: $*" >&2; exit 2; }

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

# --- Arguments -------------------------------------------------------------
ALLOW_BRANCH=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    *pb_data*) refuse "this script never uploads, overwrites or deletes pb_data (the live database)." ;;
    --allow-branch) ALLOW_BRANCH=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help) usage; exit 0 ;;
    *) refuse "unknown argument '$arg'. Run with --help." ;;
  esac
done

# --- Settings from .env (read, not executed) -------------------------------
[[ -f "$ENV_FILE" ]] || fail "no $ENV_FILE. Copy .env.example to .env and fill in the DEPLOY_ settings."

env_value() {
  # Last KEY=value line wins; surrounding quotes are removed.
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

HOST="$(env_value DEPLOY_HOST)"
DEST="$(env_value DEPLOY_PATH)"
SERVICE="$(env_value DEPLOY_SERVICE)"
PORT="$(env_value DEPLOY_PORT)"
SERVICE="${SERVICE:-ironbook}"
PORT="${PORT:-8092}"
DEST="${DEST%/}"

[[ -n "$HOST" ]] || fail "DEPLOY_HOST is not set in $ENV_FILE."
[[ "$HOST" != "you@your-server" ]] || fail "DEPLOY_HOST is still the placeholder; set your SSH login in $ENV_FILE."
[[ "$HOST" =~ ^[A-Za-z0-9._@-]+$ ]] || fail "DEPLOY_HOST '$HOST' doesn't look like user@host."
[[ -n "$DEST" ]] || fail "DEPLOY_PATH is not set in $ENV_FILE."
[[ "$DEST" == *pb_data* ]] && refuse "DEPLOY_PATH '$DEST' points into pb_data."
[[ "$DEST" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "DEPLOY_PATH '$DEST' must be an absolute path (letters, digits, . _ - /)."
[[ "/$DEST/" != */../* ]] || fail "DEPLOY_PATH '$DEST' must not contain '..'."
[[ "$SERVICE" =~ ^[A-Za-z0-9_.@-]+$ ]] || fail "DEPLOY_SERVICE '$SERVICE' is not a valid service name."
[[ "$PORT" =~ ^[0-9]+$ ]] || fail "DEPLOY_PORT '$PORT' is not a number."

# --- Git: clean tree, and main in sync with origin (unless --allow-branch) --
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || refuse "the working tree has uncommitted changes. Commit or stash them first."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$ALLOW_BRANCH" == 1 ]]; then
  echo "deploy: --allow-branch: deploying '$BRANCH' at $(git rev-parse --short HEAD)."
else
  [[ "$BRANCH" == "main" ]] || refuse "on branch '$BRANCH'. Deploy from main, or pass --allow-branch to deploy this branch deliberately."
  git fetch --quiet origin main || fail "couldn't fetch origin/main."
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] ||
    refuse "local main differs from origin/main. Pull (or push via a PR) first."
fi
echo "deploy: git checks passed."

# --- Build ------------------------------------------------------------------
echo "deploy: building..."
npm run build
[[ -f pb_public/index.html ]] || fail "build produced no pb_public/index.html."
VERSION_LABEL="$(grep -oE 'v[0-9]+\.[0-9]+(\.[0-9]+)? \([0-9a-z-]+\)' pb_public/assets/*.js | head -n 1 | cut -d: -f2- || true)"

# --- Server: reachable, folder present, pinned PocketBase -------------------
PINNED="$(grep -E '^VERSION=' scripts/setup-pocketbase.sh | cut -d'"' -f2)"
REMOTE_VERSION="$(ssh "$HOST" "'$DEST/pocketbase' --version" 2>/dev/null)" ||
  fail "couldn't run $DEST/pocketbase on $HOST. Check SSH access and the one-time server setup in the README."
[[ "$REMOTE_VERSION" == *" $PINNED" ]] ||
  fail "the server runs '$REMOTE_VERSION' but the repo pins PocketBase $PINNED. Upgrade the server binary first (read the release notes)."

# --- Upload -----------------------------------------------------------------
# Only the three folders are sent. --delete removes stale files inside them
# on the server; pb_data is excluded and protected as a second safeguard.
RSYNC=(rsync -az --delete --itemize-changes --exclude='pb_data' --filter='protect pb_data/' --exclude='.DS_Store')
[[ "$DRY_RUN" == 1 ]] && RSYNC+=(--dry-run)
echo "deploy: uploading ${UPLOAD[*]} to $HOST:$DEST/$([[ "$DRY_RUN" == 1 ]] && echo ' (dry run)')"
"${RSYNC[@]}" "${UPLOAD[@]}" "$HOST:$DEST/"

if [[ "$DRY_RUN" == 1 ]]; then
  echo "deploy: dry run finished. Nothing was uploaded or restarted."
  exit 0
fi

# --- Restart and check ------------------------------------------------------
echo "deploy: restarting $SERVICE (sudo may ask for your password)..."
ssh -t "$HOST" "sudo systemctl restart '$SERVICE'"

echo "deploy: waiting for the service to report healthy..."
ssh "$HOST" "for i in \$(seq 1 30); do curl -fsS 'http://127.0.0.1:$PORT/api/health' >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1" ||
  fail "$SERVICE didn't become healthy. Check: ssh $HOST sudo journalctl -u $SERVICE -n 50"

echo "deploy: done. Deployed ${VERSION_LABEL:-this build} to $HOST."
