<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Smart Invoice & Accounting AI (Local LLM)

A privacy-first invoice builder and AI accountant that runs entirely against **your own local LLM**. No third-party cloud AI keys required.

## Run Locally

**Prerequisites:** Node.js 20+, plus a local LLM server.

### 1. Start a local LLM

- **[Ollama](https://ollama.com)** (recommended)
  ```bash
  ollama pull llama3.2-vision:11b
  OLLAMA_ORIGINS="*" ollama serve
  ```
- Or any **OpenAI-compatible** server (LM Studio, llama.cpp `server`, vLLM, etc.) exposing a `/v1` endpoint. Allow CORS for the app origin.

A vision-capable model (e.g. `llama3.2-vision`, `llava`) is required for receipt / invoice image parsing.

### 2. Run the app

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, then go to **Settings → Local Intelligence Engine**, set the **Model Name** and **Endpoint URL**, and click **Test connection**.

## Production deployment

Live at <https://invoicesmart.cortexbuildpro.com> — served from a single VPS (`72.62.132.43`) that hosts the SPA on nginx and reverse-proxies `/ollama/` to a local Ollama instance bound to `127.0.0.1:11434`. The browser only ever talks to the public domain; the inference port is never exposed.

| Layer | What & where |
| --- | --- |
| SPA | `/var/www/invoicesmart/` (rsync target of `dist/`) |
| Web | nginx site from `infra/nginx.conf.template`, TLS via Let's Encrypt |
| LLM | Ollama systemd service, model `llama3.2-vision:11b`, bound to localhost |
| Deploys | `.github/workflows/deploy.yml` on push to `main`, SSH as the `deploy` user |
| CI | `.github/workflows/ci.yml` on every PR (typecheck + build + bundle guard) |

To redeploy the same build manually, in the **Actions** tab pick **Deploy to VPS → Run workflow** (or `gh workflow run "Deploy to VPS" -R adrianstanca1/Invoicesmart- --ref main`). The workflow accepts `domain_override` / `host_override` inputs in case you want to point the same artifact at a staging box.

## Deploy to Your Own VPS

A complete, one-command deployment is wired up:

- **`infra/setup-vps.sh`** — bootstraps the VPS: nginx, certbot, Ollama, model pull, `deploy` user, systemd hardening, TLS via Let's Encrypt.
- **`infra/nginx.conf.template`** — serves the SPA and reverse-proxies `/ollama/` → `127.0.0.1:11434`, so the browser only ever talks to your domain (no CORS pain).
- **`.github/workflows/deploy.yml`** — on every push to `main`, builds the SPA and rsyncs `dist/` to the VPS, then reloads nginx.

### 1. Bootstrap the VPS (once)

SSH into a fresh Ubuntu 22.04+ VPS as root and run:

```bash
curl -fsSL https://raw.githubusercontent.com/adrianstanca1/Invoicesmart-/main/infra/setup-vps.sh \
  | sudo DOMAIN=app.yourdomain.com \
         EMAIL=you@yourdomain.com \
         OLLAMA_MODEL=llama3.2-vision:11b \
         DEPLOY_KEY_PUB="ssh-ed25519 AAAA... github-deploy" \
         bash
```

What this does, in order:

1. Installs `nginx`, `certbot`, `rsync`, `curl`.
2. Creates a `deploy` user with sudo limited to `systemctl reload nginx`. Appends `$DEPLOY_KEY_PUB` to its `authorized_keys` so the GitHub Action can SSH in.
3. Installs Ollama, pins it to `127.0.0.1:11434` (never exposed to the public internet), enables the service, and `ollama pull`s `$OLLAMA_MODEL`.
4. Installs the nginx site for `$DOMAIN` and obtains a Let's Encrypt cert with auto-renewal.

After it finishes:

```bash
curl -fsS https://app.yourdomain.com/ollama/api/tags    # should list your model
```

### 2. Wire up the GitHub Action

Generate a dedicated deploy SSH key on your laptop:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/invoicesmart_deploy -N ""
```

In **GitHub → Settings → Secrets and variables → Actions**:

| Type     | Name              | Value                                                                |
| -------- | ----------------- | -------------------------------------------------------------------- |
| Secret   | `VPS_SSH_KEY`     | Contents of `~/.ssh/invoicesmart_deploy` (the **private** key).      |
| Secret   | `VPS_HOST`        | Your VPS hostname or IP (e.g. `app.yourdomain.com`).                 |
| Variable | `VPS_DOMAIN`      | Public domain the SPA is served from (e.g. `app.yourdomain.com`).    |
| Variable | `DEPLOY_ENABLED`  | Set to `true` to enable automatic deploys on push to `main`.         |

Pass the **public** key (`~/.ssh/invoicesmart_deploy.pub`) to the bootstrap script as `DEPLOY_KEY_PUB`, or paste it later into `/home/deploy/.ssh/authorized_keys` on the VPS.

The deploy workflow is **gated by `DEPLOY_ENABLED`**, so it stays quiet on every merge until the secrets above are wired up. Manual `workflow_dispatch` runs from the Actions tab always execute regardless of the flag, so the first deploy can be triggered without flipping anything.

### 3. Deploy

```bash
git push origin main
```

The workflow builds the SPA, rsyncs it to `/var/www/invoicesmart/`, reloads nginx, and smoke-tests the site + the `/ollama` reverse-proxy. Production builds default to the same-origin endpoint `/ollama`, so users land on a working app with zero configuration.
