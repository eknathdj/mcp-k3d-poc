#!/usr/bin/env bash
set -euo pipefail
echo "Deleting k3d clusters named sandbox-*"
for c in $(k3d cluster list -o json | jq -r '.[].name' 2>/dev/null | grep '^sandbox-' || true); do
  echo "Deleting $c"
  k3d cluster delete "$c" || true
done
echo "Removing kubeconfig files (server/kubeconfigs/*) and DB"
rm -f server/kubeconfigs/* || true
rm -f server/mcp.db || true
echo "Done"
