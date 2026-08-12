# feeds.themarfa.name

Image builds in GitHub Actions → GHCR. VPS pulls and blue-green reloads — live slot keeps serving until idle is healthy.

```bash
cd /opt/freshrss
./blue-green-deploy.sh
```

| Piece | Where |
|---|---|
| App image | `ghcr.io/marfa/freshrss:edge` |
| Slots | `freshrss-a` `:8083`, `freshrss-b` `:8087` |
| Active slot | `/opt/freshrss/active` (`a` or `b`) |
| User data | Docker volume `freshrss_data` |
| Nginx upstream | `snippets/freshrss-upstream.conf` (switched on deploy) |
| Nginx ytcdn | Managed on VPS only (`snippets/freshrss-ytcdn.conf`) — not overwritten by Actions |
| Update banner | `/build-id.txt` + `instance_update.js` |

Port **8084 is paymentbot** — never use it for FreshRSS.

Nginx site must include the upstream snippet (not an inline `upstream`):

```nginx
include /etc/nginx/snippets/freshrss-upstream.conf;
# … then proxy_pass http://freshrss_upstream;
```

Secrets for Actions: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

Код подготовлен с помощью Cursor  
Поддержка проекта [Донат](https://www.donationalerts.com/r/themarfa)  
Донат [криптой](https://nowpayments.io/donation/themarfa)
