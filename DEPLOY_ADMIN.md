# Deploying Lyceum Connect to portal.lgh.lk  —  for the server admin

The portal front-end is updated. Please pull the latest code and redeploy.
Everything is on the **`main`** branch of `git@github.com:globallyceum25-dot/Portal.git`.

The site is served by the Docker service **`lyceum-portal-production`** (port 3001),
fronted by a Cloudflare Tunnel — as set up in [`CLOUDFLARE.md`](CLOUDFLARE.md).

## One-time / each-release deploy

SSH into the server, then from the directory that holds `docker-compose.yml` +
the git checkout:

```bash
cd /path/to/lyceum-portal            # the repo checkout the container serves
git fetch --all --prune
git reset --hard origin/main         # take the latest pushed code exactly
docker compose up -d --build lyceum-portal-production
docker image prune -f
git rev-parse --short HEAD           # note the deployed commit
```

> If the container **volume-mounts** the static files (rather than baking them into
> the image), you don't need `--build` — a `git pull` + `docker compose restart
> lyceum-portal-production` is enough.

## Purge the Cloudflare cache (required)

Cloudflare caches the HTML/JS, so visitors keep seeing the old build until you purge:

- **Dashboard:** Cloudflare → `lgh.lk` → **Caching → Configuration → Purge Everything**, or
- **API:**
  ```bash
  curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
    -H "Authorization: Bearer <API_TOKEN>" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}'
  ```

## Optional — make future pushes deploy automatically

Because the server is behind the Cloudflare Tunnel (no inbound SSH), the cleanest
way to automate is a **self-hosted GitHub Actions runner installed on this server**
(it connects *outbound* to GitHub, so the tunnel isn't a problem):

```bash
# On the server, in a working dir — follow the exact download/token steps from
# GitHub → repo → Settings → Actions → Runners → New self-hosted runner
./config.sh --url https://github.com/globallyceum25-dot/Portal --token <RUNNER_TOKEN> --labels lyceum-prod
sudo ./svc.sh install && sudo ./svc.sh start
```

Once a runner exists, ping the repo owner — a `runs-on: [self-hosted, lyceum-prod]`
workflow can run the deploy + cache-purge steps above on every push to `main`.
```
