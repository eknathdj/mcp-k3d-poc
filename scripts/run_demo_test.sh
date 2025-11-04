#!/usr/bin/env bash
set -euo pipefail
KUBECONFIG_PATH="$1"
if [ -z "$KUBECONFIG_PATH" ]; then
  echo '{"status":"ERROR","details":"kubeconfig missing"}'
  exit 2
fi
export KUBECONFIG="$KUBECONFIG_PATH"
NAMESPACE=demo
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
kubectl run nginx-test --image=nginx --restart=Never -n ${NAMESPACE} || true
for i in $(seq 1 20); do
  POD=$(kubectl get pods -n ${NAMESPACE} -o name | head -n1 | cut -d'/' -f2 || true)
  if [ -n "$POD" ]; then
    READY=$(kubectl get pod -n ${NAMESPACE} "$POD" -o jsonpath='{.status.containerStatuses[0].ready}' || echo "false")
    if [ "$READY" = "true" ]; then
      break
    fi
  fi
  sleep 2
done
POD=$(kubectl get pods -n ${NAMESPACE} -o name | head -n1 | cut -d'/' -f2 || true)
if [ -z "$POD" ]; then
  echo '{"status":"FAIL","details":"pod not created"}'
  exit 3
fi
kubectl port-forward -n ${NAMESPACE} "$POD" 8080:80 >/tmp/portfw.log 2>&1 &
sleep 2
if curl -sS http://localhost:8080 | head -n1 >/tmp/curl.out; then
  echo '{"status":"PASS","details":"nginx responded"}'
  exit 0
else
  echo '{"status":"FAIL","details":"nginx not responding"}'
  exit 4
fi
