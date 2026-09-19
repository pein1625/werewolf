#!/usr/bin/env bash
# Tự deploy không cần GitHub Actions.
# Cron gọi định kỳ: thấy commit mới trên nhánh theo dõi thì build, chạy test, rồi mới đổi container.
# Test hỏng -> giữ nguyên bản đang chạy, ghi lại sha hỏng để không build lại vô hạn.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/deploy/apps/werewolf}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-werewolf}"

cd "$APP_DIR"

FAILED_FILE="$APP_DIR/.deploy-failed-sha"

log() { echo "[$(date -Is)] $*"; }

git fetch --quiet --prune origin "$BRANCH"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")

[ "$local_sha" = "$remote_sha" ] && exit 0

# commit này đã thử và hỏng rồi, đừng build lại mỗi phút
if [ -f "$FAILED_FILE" ] && [ "$(cat "$FAILED_FILE")" = "$remote_sha" ]; then
  exit 0
fi

log "commit mới: ${local_sha:0:7} -> ${remote_sha:0:7}"
git merge --ff-only "origin/$BRANCH"

log "build image"
docker compose build

log "chạy test trong image vừa build"
if ! docker compose run --rm --no-deps "$SERVICE" npm test; then
  log "TEST HỎNG — giữ nguyên bản đang chạy, không đổi container"
  echo "$remote_sha" > "$FAILED_FILE"
  git reset --hard "$local_sha"
  exit 1
fi

log "test xanh, đổi sang bản mới"
docker compose up -d
docker image prune -f
rm -f "$FAILED_FILE"
log "xong: $(git rev-parse --short HEAD)"
