# The deploy's upload step, sourced by deploy.sh (and by its tests, which
# run it against local folders). Bash 3.2 compatible (macOS).
#
# Safety, in layers:
#   1. Only these three folders are sent, so nothing else on the server is
#      touched; --delete only removes stale files inside them.
#   2. --exclude='pb_data' never sends a pb_data folder, even if the source
#      list were widened by mistake (and rsync never deletes excluded files).
#   3. --filter='protect pb_data/' guards against a future edit adding
#      --delete-excluded. It must come before the exclude (rsync rules are
#      first-match). GNU rsync honors it; Apple's openrsync (the macOS
#      default) does not, so on a Mac layers 1 and 2 are what keep pb_data
#      safe. Both hold there, and both are tested.
#
# --checksum compares file contents, not just size and modification time,
# so a changed file is never skipped (the folders are only a few MB).

DEPLOY_UPLOAD_DIRS=(pb_public pb_hooks pb_migrations)
DEPLOY_RSYNC_FLAGS=(-az --checksum --delete --itemize-changes --filter='protect pb_data/' --exclude='pb_data' --exclude='.DS_Store')

# deploy_upload <source root> <destination> [dry-run]
#   Copies the three folders from the source root (the repo) into the
#   destination folder ("user@host:/opt/app" or a local path). With a third
#   argument of 1, only shows what would change.
deploy_upload() {
  local src="$1" dest="$2" dry="${3:-0}"
  local flags=("${DEPLOY_RSYNC_FLAGS[@]}")
  [[ "$dry" == 1 ]] && flags+=(--dry-run)
  (cd "$src" && rsync "${flags[@]}" "${DEPLOY_UPLOAD_DIRS[@]}" "${dest%/}/")
}
