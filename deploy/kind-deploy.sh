#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHART_DIR="${ROOT_DIR}/deploy/helm/gestao-financeira"

IMAGE_REPO="${IMAGE_REPO:-gestao-financeira-hlg}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"
KIND_CLUSTER="${KIND_CLUSTER:-gestao-hlg}"
RELEASE_NAME="${RELEASE_NAME:-gestao-hlg}"
NAMESPACE="${NAMESPACE:-gestao-financeira-hlg}"
APP_NAME="${APP_NAME:-gestao-financeira-hlg}"
WITH_EXTERNAL_DB="${WITH_EXTERNAL_DB:-false}"
DB_SECRET="${DB_SECRET:-gestao-financeira-hlg-db}"
DB_SERVICE="${DB_SERVICE:-db-gestao-financeira-hlg}"
DB_PORT="${DB_PORT:-3306}"

add_helm_ownership() {
  local kind="$1"
  local name="$2"

  if kubectl get "$kind" "$name" -n "${NAMESPACE}" >/dev/null 2>&1; then
    kubectl label "$kind" "$name" -n "${NAMESPACE}" app.kubernetes.io/managed-by=Helm --overwrite >/dev/null
    kubectl annotate "$kind" "$name" -n "${NAMESPACE}" \
      meta.helm.sh/release-name="${RELEASE_NAME}" \
      meta.helm.sh/release-namespace="${NAMESPACE}" \
      --overwrite >/dev/null
  fi
}

echo "[1/5] Building Docker image ${IMAGE}"
docker build -t "${IMAGE}" "${ROOT_DIR}"

echo "[2/5] Loading image into kind cluster ${KIND_CLUSTER}"
kind load docker-image "${IMAGE}" --name "${KIND_CLUSTER}"

if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  echo "[3/5] Namespace ${NAMESPACE} not found. Creating it."
  kubectl create namespace "${NAMESPACE}"
else
  echo "[3/5] Namespace ${NAMESPACE} already exists"
fi

echo "[3.5/5] Aligning legacy resources with Helm ownership"
add_helm_ownership service "${APP_NAME}"
add_helm_ownership secret "${DB_SECRET}"
add_helm_ownership ingress "${APP_NAME}"
add_helm_ownership deployment "${APP_NAME}"

echo "[4/5] Deploying Helm release ${RELEASE_NAME}"
if [[ "${WITH_EXTERNAL_DB}" == "true" ]]; then
  helm upgrade --install "${RELEASE_NAME}" "${CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --set namespace.create=false \
    --set-string image.repository="${IMAGE_REPO}" \
    --set-string image.tag="${IMAGE_TAG}" \
    --set-string fullnameOverride="${APP_NAME}" \
    --set database.enabled=false \
    --set-string app.database.host="${DB_SERVICE}" \
    --set-string app.database.port="${DB_PORT}" \
    --set-string app.database.secretName="${DB_SECRET}"
else
  helm upgrade --install "${RELEASE_NAME}" "${CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --set namespace.create=false \
    --set-string image.repository="${IMAGE_REPO}" \
    --set-string image.tag="${IMAGE_TAG}" \
    --set-string fullnameOverride="${APP_NAME}"
fi

echo "[5/5] Deployment status"
helm status "${RELEASE_NAME}" -n "${NAMESPACE}" || true
kubectl rollout status deployment "${APP_NAME}" -n "${NAMESPACE}" --timeout=120s || true
kubectl get pods -n "${NAMESPACE}" -o wide

echo "Done. Image ${IMAGE} is deployed to namespace ${NAMESPACE}."
