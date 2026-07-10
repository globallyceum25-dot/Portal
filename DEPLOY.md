# Deploying to portal.lgh.lk

Every push to `main` is deployed automatically by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow SSHes
into the production server, pulls the new commit, rebuilds the Docker container, and
purges the Cloudflare cache so visitors see the change straight away.

**The workflow does nothing until the secrets below are set** — it will run green and
skip itself, printing a warning, so your first push after adding it won't fail.

## 1. Add the GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Required | What it is |
|---|---|---|
| `SSH_HOST` | ✅ | Server IP or hostname running the portal container |
| `SSH_USER` | ✅ | SSH login user (must be able to run `docker compose`) |
| `SSH_KEY` | ✅ | **Private** SSH key (full PEM) whose public half is in that user's `~/.ssh/authorized_keys` |
| `DEPLOY_PATH` | ✅ | Absolute path on the server that holds `docker-compose.yml` + the git checkout |
| `CLOUDFLARE_ZONE_ID` | ✅ | Zone ID for `lgh.lk` (Cloudflare dashboard → the domain → **Overview**, right sidebar) |
| `CLOUDFLARE_API_TOKEN` | ✅ | Token with **Zone → Cache Purge** permission (see below) |
| `SSH_PORT` | optional | SSH port if not `22` |
| `DOCKER_SERVICE` | optional | Compose service name; defaults to `lyceum-portal-production` |

### Creating the SSH key (if you don't already have a deploy key)

On your machine:

```bash
ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions-deploy"
ssh-copy-id -i deploy_key.pub SSH_USER@SSH_HOST      # installs the public key on the server
# then paste the contents of the PRIVATE file `deploy_key` into the SSH_KEY secret
```

### Creating the Cloudflare token

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Create Custom Token**:

- Permissions: **Zone → Cache Purge → Purge**
- Zone Resources: **Include → Specific zone → lgh.lk**
- Create, copy the token into the `CLOUDFLARE_API_TOKEN` secret.

## 2. Trigger it

Push to `main` (or use **Actions → Deploy to portal.lgh.lk → Run workflow**). Watch the
run under the repo's **Actions** tab. The final log lines show the deployed commit hash
and `Cloudflare cache purged.`

## What the deploy actually runs on the server

```bash
cd "$DEPLOY_PATH"
git fetch --all --prune
git reset --hard origin/main          # matches the pushed commit exactly
docker compose up -d --build "$DOCKER_SERVICE"
docker image prune -f
```

> **Note:** it uses `git reset --hard`, so any *uncommitted local edits on the server*
> are discarded on each deploy. That's intentional for a deploy target — make all
> changes through git, not by editing files on the box.
