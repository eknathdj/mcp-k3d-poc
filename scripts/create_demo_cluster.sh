#!/usr/bin/env bash
set -euo pipefail
CLUSTER_NAME=${1:-sandbox-local}
echo "Creating k3d cluster: ${CLUSTER_NAME}"
k3d cluster create "${CLUSTER_NAME}" --servers 1 --agents 2 --wait
echo "Cluster created. Kubeconfig for ${CLUSTER_NAME}:"
k3d kubeconfig get "${CLUSTER_NAME}"
