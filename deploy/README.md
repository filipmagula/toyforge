# Deploying ToyForge 3D to the Hetzner VPS

Target: `https://toyforge.chupa.nexus`, served by the VPS's existing **nginx** (same as `flow.chupa.nexus`), with the app in one Docker container bound to `127.0.0.1`.

```
Internet ──443──> nginx (TLS via certbot) ──> 127.0.0.1:3000 ──> toyforge container (API + static files)
                                                                  └── deploy/data  (SQLite + uploaded models)
```

## 1. DNS

Add an `A` record `toyforge.chupa.nexus` → the VPS IPv4 (and `AAAA` → IPv6 if the server has one). Wait until `dig +short toyforge.chupa.nexus` returns the IP.

## 2. Get the code and configure

```bash
sudo mkdir -p /opt/toyforge && sudo chown $USER /opt/toyforge
git clone <repo-url> /opt/toyforge
cd /opt/toyforge/deploy
cp .env.example .env            # edit HOST_PORT if 3000 is already used on the VPS
mkdir -p data && sudo chown 1000:1000 data   # container runs as uid 1000 ("node")
```

Check that the port is free: `ss -ltnp | grep 3000` (should print nothing).

## 3. Build and start

```bash
docker compose up -d --build
docker compose ps                 # STATUS should become "healthy"
curl -s http://127.0.0.1:3000/api/health   # {"ok":true}
```

## 4. nginx + HTTPS

```bash
sudo cp nginx/toyforge.chupa.nexus.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/toyforge.chupa.nexus.conf /etc/nginx/sites-enabled/
# if HOST_PORT is not 3000, change both proxy_pass lines in the file
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d toyforge.chupa.nexus
```

If `flow.chupa.nexus` gets its certificate some other way (e.g. a wildcard cert, or acme.sh), add a `listen 443 ssl` block the same way that site does instead of running certbot.

Open `https://toyforge.chupa.nexus/teacher`, create a test class, and send a model from a tablet.

## Updating

```bash
cd /opt/toyforge && git pull
cd deploy && docker compose up -d --build
docker image prune -f
```

The data directory is untouched by updates.

## Operations

| What | Where / how |
|---|---|
| App logs | `docker compose logs -f app` (rotated: 3 × 10 MB) |
| nginx logs | `/var/log/nginx/toyforge.access.log` |
| Data | `deploy/data/toyforge.db` (SQLite) and `deploy/data/classes/<class-id>/` (STL + PNG) |
| Retention | classes are deleted automatically 30 days after their last activity (hourly job) |
| Backups | not needed by design (data is short-lived); take a Hetzner snapshot before big upgrades |
| Disk | the app logs a warning when less than 1 GB is free; a full class (500 models) is ~0.5 GB |
| Settings | `deploy/.env` (`PUBLIC_URL`, `HOST_PORT`, `RETENTION_DAYS`, `MAX_MODELS_PER_CLASS`), then `docker compose up -d` |

### Why the fixed Docker subnet?

nginx on the host reaches the container through the Docker network gateway, not `127.0.0.1`. The compose file pins the network to `172.31.250.0/24` and sets `TRUST_PROXY` to it, so the app trusts `X-Forwarded-For` from nginx only. Rate limits then apply to each real client IP instead of treating every request as coming from one address. If that subnet clashes with something on the VPS, change it in both places in `docker-compose.yml`.
