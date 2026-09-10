#!/usr/bin/env bash
# Run on the server, inside the deploy directory (which holds only
# docker-compose.prod.yml, .env, and this scripts/ folder -- not the app
# source). Pulls whatever image IMAGE_TAG in .env points at from GHCR and
# restarts the stack. Requires a prior `docker login ghcr.io` if the images
# are private.
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
