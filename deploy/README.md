# feeds.themarfa.name

Image is built in GitHub Actions and published to GHCR. The VPS only pulls and restarts.

| Piece | Where |
|---|---|
| App image | `ghcr.io/marfa/freshrss:edge` |
| User data | Docker volume `freshrss_data` |
| Extensions | Baked into the image under `extensions/` |
| Nginx ytcdn | `deploy/nginx/freshrss-ytcdn.conf` synced on deploy |

```bash
# On VPS after first successful GHCR push:
cd /opt/freshrss
docker compose pull
docker compose up -d
```

Secrets for Actions: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
