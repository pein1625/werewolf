#!/usr/bin/env bash
# Tự deploy không cần GitHub Actions.
# Cron gọi định kỳ: thấy commit mới trên nhánh theo dõi thì build, chạy test, rồi mới đổi container.
# Test hỏng -> giữ nguyên bản đang chạy, ghi lại sha hỏng để không build lại vô hạn.
set -euo pipefail

# git merge ở dưới sẽ ghi đè chính file này. Bash đọc script theo vị trí byte chứ không nạp
# hết vào bộ nhớ, nên file bị thay giữa chừng có thể khiến nó đọc tiếp ở offset cũ của nội
# dung mới — chạy nhầm dòng, không báo lỗi gì. Chạy từ một bản sao để git ghi đè bao nhiêu
# cũng không ảnh hưởng tiến trình đang chạy.
if [ -z "${DEPLOY_FROM_COPY:-}" ]; then
  self_copy=$(mktemp /tmp/auto-deploy.XXXXXX.sh)
  cat "$0" > "$self_copy"
  chmod +x "$self_copy"
  DEPLOY_FROM_COPY=1 exec "$self_copy" "$@"
fi
trap 'rm -f "$0"' EXIT

APP_DIR="${APP_DIR:-/home/deploy/apps/werewolf}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-werewolf}"

cd "$APP_DIR"

FAILED_FILE="$APP_DIR/.deploy-failed-sha"
# Ghi sau khi container mới chạy được. So với file này, KHÔNG so với HEAD của repo:
# repo tiến lên ngay lúc merge, còn container thì mãi sau mới đổi. Build chết hoặc máy
# reboot giữa chừng mà so bằng HEAD thì vòng sau tưởng xong rồi, kẹt ở bản cũ không ai biết.
DEPLOYED_FILE="$APP_DIR/.deployed-sha"

log() { echo "[$(date -Is)] $*"; }

git fetch --quiet --prune origin "$BRANCH"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")
deployed_sha=$(cat "$DEPLOYED_FILE" 2>/dev/null || echo "")

[ "$deployed_sha" = "$remote_sha" ] && exit 0

# commit này đã thử và hỏng rồi, đừng build lại mỗi phút
if [ -f "$FAILED_FILE" ] && [ "$(cat "$FAILED_FILE")" = "$remote_sha" ]; then
  exit 0
fi

if [ "$local_sha" = "$remote_sha" ]; then
  log "code đã đúng bản mới nhưng container chưa đổi — làm lại từ bước build"
else
  log "commit mới: ${local_sha:0:7} -> ${remote_sha:0:7}"
  git merge --ff-only "origin/$BRANCH"
fi

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
git rev-parse HEAD > "$DEPLOYED_FILE"
rm -f "$FAILED_FILE"
log "xong: $(git rev-parse --short HEAD)"
