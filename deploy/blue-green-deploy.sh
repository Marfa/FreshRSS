#!/usr/bin/env bash
# Blue-green reload: pull image, start idle slot, switch nginx upstream, stop old slot.
# Ports: a=8083, b=8087 (8084 is paymentbot on this VPS).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/freshrss}"
IMAGE="${IMAGE:-ghcr.io/marfa/freshrss:edge}"
ACTIVE_FILE="$DEPLOY_DIR/active"
UPSTREAM_SNIP="${UPSTREAM_SNIP:-/etc/nginx/snippets/freshrss-upstream.conf}"
HEALTH_TRIES="${HEALTH_TRIES:-30}"
HEALTH_SLEEP="${HEALTH_SLEEP:-2}"

port_for() {
	case "$1" in
	a) echo 8083 ;;
	b) echo 8087 ;;
	*)
		echo "bad slot: $1" >&2
		exit 1
		;;
	esac
}

write_upstream() {
	local slot="$1"
	local port
	port="$(port_for "$slot")"
	umask 022
	cat >"$UPSTREAM_SNIP" <<EOF
# Managed by deploy/blue-green-deploy.sh — active freshrss-$slot
upstream freshrss_upstream {
	server 127.0.0.1:${port};
	keepalive 8;
}
EOF
	nginx -t
	systemctl reload nginx
}

wait_healthy() {
	local port="$1"
	local label="$2"
	local code ok=0
	echo "⏳ Waiting for $label on :$port"
	for _ in $(seq 1 "$HEALTH_TRIES"); do
		code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/" || true)"
		if [[ "$code" =~ ^(2|3)[0-9][0-9]$ || "$code" == "401" || "$code" == "403" ]]; then
			ok=1
			echo "✅ $label healthy (HTTP $code)"
			break
		fi
		sleep "$HEALTH_SLEEP"
	done
	if [[ "$ok" -ne 1 ]]; then
		echo "❌ $label did not become healthy on :$port" >&2
		return 1
	fi
}

cd "$DEPLOY_DIR"

if [[ ! -f docker-compose.yml ]]; then
	echo "❌ $DEPLOY_DIR/docker-compose.yml missing" >&2
	exit 1
fi

if ! grep -Rqs 'freshrss-upstream.conf' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null; then
	echo "⚠️  nginx site must include snippets/freshrss-upstream.conf (upstream freshrss_upstream)" >&2
fi

docker pull "$IMAGE"

active="$(cat "$ACTIVE_FILE" 2>/dev/null || true)"

# --- One-time migration from legacy container_name: freshrss (port 8083) ---
if docker ps -a --format '{{.Names}}' | grep -qx freshrss; then
	echo "ℹ️ Migrating legacy container freshrss → blue-green slots"
	docker compose up -d --force-recreate --no-deps freshrss-b
	wait_healthy 8087 freshrss-b || {
		docker compose stop freshrss-b || true
		exit 2
	}
	write_upstream b
	echo b >"$ACTIVE_FILE"
	docker stop freshrss || true
	docker rm freshrss || true
	docker compose stop freshrss-a || true
	docker image prune -f
	docker ps --filter name=freshrss --format '{{.Names}} {{.Image}} {{.Status}}'
	echo "✅ Migration complete: traffic → freshrss-b :8087"
	exit 0
fi

if [[ "$active" != "a" && "$active" != "b" ]]; then
	active=a
	echo "$active" >"$ACTIVE_FILE"
fi

if [[ "$active" == "a" ]]; then
	idle=b
else
	idle=a
fi

idle_port="$(port_for "$idle")"
active_port="$(port_for "$active")"

echo "➡️ Active=freshrss-$active (:$active_port)  Idle=freshrss-$idle (:$idle_port)"

docker compose up -d "freshrss-$active"
docker compose up -d --force-recreate --no-deps "freshrss-$idle"

if ! wait_healthy "$idle_port" "freshrss-$idle"; then
	echo "❌ Leaving nginx on freshrss-$active" >&2
	docker compose stop "freshrss-$idle" || true
	exit 2
fi

write_upstream "$idle"
echo "$idle" >"$ACTIVE_FILE"
docker compose stop "freshrss-$active"

docker image prune -f
docker ps --filter name=freshrss --format '{{.Names}} {{.Image}} {{.Status}}'
echo "✅ Blue-green complete: traffic → freshrss-$idle :$idle_port"
