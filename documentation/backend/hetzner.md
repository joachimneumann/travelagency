# Hetzner CX32 Staging Deployment Guide (Chapter2)

This guide is written for non-experts. Follow the steps in order.

Target outcome:
- Frontend available at `https://staging.chapter2.live`
- Backend available at `https://api-staging.chapter2.live`
- Keycloak available at `https://auth-staging.chapter2.live`

## 0) Recommended order: local preparation first, then deployment

Before deploying to Hetzner, do these steps locally in this order:

1. Freeze staging scope
- Decide exactly what features are in staging.
- Avoid additional structural refactors during deployment setup.

2. Move persistence from JSON files to PostgreSQL locally
- Recommended before deployment.
- Keep API endpoints unchanged so frontend behavior stays stable.
- Migrate at least: tours, leads, customers, activities.

3. Add migrations and seed scripts
- Use a migration system (for example Prisma or Knex).
- Ensure one-command local setup for DB:
  - migrate
  - seed

4. Make configuration fully environment-driven
- No hardcoded localhost URLs or secrets.
- Keep separate env files for local and staging.

5. Run a local production-like stack
- Use Docker Compose locally with:
  - backend
  - postgres
  - keycloak
  - reverse proxy
- Validate complete login + CRUD + tour image flow.

6. Keep media outside the database
- Continue storing tour images as files/object storage.
- Keep DB references (paths/keys) only.

7. Harden before deploy
- Remove dev fallbacks/tokens.
- Restrict CORS to staging domain.
- Confirm health checks and logs.

8. Prepare deployment artifacts
- Have ready:
  - `docker-compose.staging.yml`
  - reverse proxy config
  - `.env.staging.example`
  - deploy/update script
  - rollback notes

After local preparation is done, continue with the Hetzner deployment steps below.

## 1) Before you start

You need:
- A Hetzner Cloud account
- Domain DNS control for `chapter2.live`
- Your local project files
- Basic terminal access

You will use:
- Hetzner CX32 (Ubuntu 24.04)
- Docker + Docker Compose
- Caddy for HTTPS and reverse proxy

## 2) Create the Hetzner server

1. In Hetzner Cloud Console, create server:
- Type: `CX32`
- Image: `Ubuntu 24.04`
- Region: closest to your team
- Network: Public IPv4 (and IPv6 if available)

2. Add your SSH key during creation.

3. After creation, note the public IP address as `<SERVER_IP>`.

## 3) Point DNS to the server

Create DNS records:
- `staging.chapter2.live` -> A -> `<SERVER_IP>`
- `api-staging.chapter2.live` -> A -> `<SERVER_IP>`
- `auth-staging.chapter2.live` -> A -> `<SERVER_IP>`

Optional (if IPv6 used): add AAAA records.

Wait until DNS propagates (usually a few minutes).

## 4) First login and base security

SSH into server:

```bash
ssh root@<SERVER_IP>
```

Create a deploy user:

```bash
adduser chapter2
usermod -aG sudo chapter2
```

Copy SSH authorized keys to new user:

```bash
mkdir -p /home/chapter2/.ssh
cp /root/.ssh/authorized_keys /home/chapter2/.ssh/authorized_keys
chown -R chapter2:chapter2 /home/chapter2/.ssh
chmod 700 /home/chapter2/.ssh
chmod 600 /home/chapter2/.ssh/authorized_keys
```

Switch to new user:

```bash
su - chapter2
```

Install updates:

```bash
sudo apt update && sudo apt -y upgrade
```

Enable firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

## 5) Install Docker and Compose

```bash
sudo apt update
sudo apt -y install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

## 6) Upload the project to server

On your local machine, run:

```bash
rsync -avz --exclude '.git' /Users/internal_admin/projects/travelagency/ chapter2@<SERVER_IP>:/home/chapter2/travelagency/
```

On server:

```bash
cd /home/chapter2/travelagency
```

## 7) Create staging compose file

Create `/home/chapter2/travelagency/docker-compose.staging.yml`:

```yaml
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - ./:/srv:ro
    depends_on:
      - backend
      - keycloak

  backend:
    image: node:20-alpine
    restart: unless-stopped
    working_dir: /app
    command: sh -c "npm ci && npm start"
    volumes:
      - ./backend/app:/app
    env_file:
      - .env.staging

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    restart: unless-stopped
    command: start
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: ${KEYCLOAK_ADMIN}
      KC_BOOTSTRAP_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: ${POSTGRES_USER}
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD}
      KC_PROXY_HEADERS: xforwarded
      KC_HOSTNAME: auth-staging.chapter2.live
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  caddy_data:
  caddy_config:
  postgres_data:
```

## 8) Create Caddy config

Create `/home/chapter2/travelagency/deploy/Caddyfile`:

```caddy
staging.chapter2.live {
  root * /srv
  file_server
}

api-staging.chapter2.live {
  reverse_proxy backend:8787
}

auth-staging.chapter2.live {
  reverse_proxy keycloak:8080
}
```

## 9) Create staging environment file

Create `/home/chapter2/travelagency/.env.staging`:

```env
PORT=8787
CORS_ORIGIN=https://staging.chapter2.live

KEYCLOAK_ENABLED=true
KEYCLOAK_BASE_URL=https://auth-staging.chapter2.live
KEYCLOAK_REALM=master
KEYCLOAK_CLIENT_ID=chapter2-backend
KEYCLOAK_CLIENT_SECRET=CHANGE_ME_CLIENT_SECRET
KEYCLOAK_REDIRECT_URI=https://api-staging.chapter2.live/auth/callback
KEYCLOAK_ALLOWED_ROLES=admin,staff
KEYCLOAK_GLOBAL_LOGOUT=true
RETURN_TO_ALLOWED_ORIGINS=https://staging.chapter2.live,https://api-staging.chapter2.live

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD
POSTGRES_USER=keycloak
POSTGRES_PASSWORD=CHANGE_ME_DB_PASSWORD
```

Important:
- Replace all `CHANGE_ME_*` values with real secrets.

## 10) Start staging services

```bash
cd /home/chapter2/travelagency
docker compose -f docker-compose.staging.yml up -d
```

Check status:

```bash
docker compose -f docker-compose.staging.yml ps
```

Check backend health:

```bash
curl -i https://api-staging.chapter2.live/health
```

## 11) Configure Keycloak client for backend login

1. Open: `https://auth-staging.chapter2.live`
2. Login with admin user from `.env.staging`
3. Create or edit client `chapter2-backend`

Set in Keycloak client:
- Root URL: `https://api-staging.chapter2.live`
- Valid redirect URIs:
  - `https://api-staging.chapter2.live/auth/callback`
- Valid post logout redirect URIs:
  - `https://staging.chapter2.live/*`
  - `https://api-staging.chapter2.live/*`
- Web origins:
  - `https://staging.chapter2.live`
  - `https://api-staging.chapter2.live`

Copy the client secret and update `.env.staging` (`KEYCLOAK_CLIENT_SECRET`).

Restart backend after secret update:

```bash
docker compose -f docker-compose.staging.yml restart backend
```

## 12) Verify full flow

1. Open `https://staging.chapter2.live`
2. Click Backend button.
3. Login through Keycloak.
4. Verify redirect to backend page and data loads.
5. Open a tour and save changes.

## 13) Day-2 operations

Update deployment:

```bash
cd /home/chapter2/travelagency
# upload changed files from local with rsync again
docker compose -f docker-compose.staging.yml up -d --build
```

Logs:

```bash
docker compose -f docker-compose.staging.yml logs -f backend
docker compose -f docker-compose.staging.yml logs -f keycloak
docker compose -f docker-compose.staging.yml logs -f caddy
```

Backup Postgres (daily recommended):

```bash
docker compose -f docker-compose.staging.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" keycloak > /home/chapter2/keycloak_backup_$(date +%F).sql
```

## 14) Common issues

- `502 Bad Gateway` on domain:
  - Service not running. Check `docker compose ps` and logs.

- Keycloak login works but backend says unauthorized:
  - Wrong client secret or redirect URI mismatch.

- CORS errors:
  - Ensure `CORS_ORIGIN=https://staging.chapter2.live`.

- TLS certificate not issued:
  - DNS A record not pointing to correct server IP.

## 15) Security minimum checklist

- Change all default passwords.
- Keep `.env.staging` only on server.
- Disable root SSH password login.
- Keep firewall enabled.
- Use regular backups.
