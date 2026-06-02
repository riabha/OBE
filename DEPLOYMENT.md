# OBE Portal — Deployment Guide

**Read this before changing the live website.**

---

## Deployment workflow (always follow this order)

```
┌─────────────────────────────────────────────────────────────┐
│  1. WINDOWS — Edit code locally                             │
│  2. WINDOWS — Push to GitHub  ← ALWAYS DO THIS FIRST        │
│  3. VPS     — Pull + rebuild  ← Only after step 2           │
│  4. Browser — Hard refresh (Ctrl+Shift+R)                   │
└─────────────────────────────────────────────────────────────┘
```

### Step 1 — Make changes on your PC

Edit files in `d:\gitobe2June2026\OBE` (HTML, JS, server.js, etc.).

### Step 2 — Push to GitHub (Windows)

```powershell
cd d:\gitobe2June2026\OBE
.\deploy.ps1 "Describe what you changed"
```

Or:

```powershell
npm run deploy -- "Describe what you changed"
```

This commits and pushes to https://github.com/riabha/OBE (`main` branch).

> **Note:** `.env` is **never** pushed to GitHub (secrets stay on the server only).

### Step 3 — Update the live server (VPS)

SSH in, then run **one** of these:

```bash
cd /www/wwwroot/obe-portal && ./update-server.sh
```

Or manually:

```bash
cd /www/wwwroot/obe-portal
git fetch origin main && git reset --hard origin/main
docker-compose up -d --build obe-app
curl -s http://localhost:3200/api/health
```

Expected: `"database":"connected"`

### Step 4 — Verify in browser

- Hard refresh: **Ctrl + Shift + R**
- App: http://194.60.87.212:3200

---

## Live server reference

| Item | Value |
|------|--------|
| **VPS IP** | `194.60.87.212` |
| **App URL** | http://194.60.87.212:3200 |
| **Login** | http://194.60.87.212:3200/login |
| **Pro Super Admin** | http://194.60.87.212:3200/pro-super-admin-dashboard.html |
| **University Super Admin** | http://194.60.87.212:3200/university-super-admin-dashboard.html |
| **Mongo Express (DB UI)** | http://194.60.87.212:8081 |
| **GitHub** | https://github.com/riabha/OBE |
| **Server path** | `/www/wwwroot/obe-portal` |
| **Branch** | `main` |

---

## Ports

| Service | Port | Public? |
|---------|------|---------|
| OBE App | **3200** | Yes |
| MongoDB | 27018 | No (localhost only on VPS) |
| Mongo Express | **8081** | Yes (after firewall + `--profile tools`) |

Inside Docker the app listens on `3000`; host maps it to `3200`.

---

## Environment file (`.env`)

`.env` lives **only on the VPS** (and your local PC copy). It is in `.gitignore`.

### Create / replace `.env` on VPS — one command

Run on the server **after SSH**:

```bash
cat > /www/wwwroot/obe-portal/.env << 'EOF'
APP_PORT=3200
NODE_ENV=production
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=SecureOBE2025MongoDBQuest
JWT_SECRET=OBE2025SecureJWTSecretForQuestUniversityPortal123456789
SESSION_SECRET=QuestOBESessionSecret2025SecureRandomString987654321
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=OBEExpress2025Admin
EOF
```

Then apply (does **not** delete database data):

```bash
cd /www/wwwroot/obe-portal && docker-compose restart obe-app && docker-compose --profile tools up -d mongo-express && curl -s http://localhost:3200/api/health
```

### `.env` variable reference

| Variable | Purpose |
|----------|---------|
| `APP_PORT` | Public website port (3200) |
| `NODE_ENV` | `production` |
| `MONGO_ROOT_USER` | MongoDB admin username |
| `MONGO_ROOT_PASSWORD` | MongoDB admin password — **do not change** after first deploy |
| `JWT_SECRET` | App login tokens |
| `SESSION_SECRET` | App sessions |
| `MONGO_EXPRESS_PORT` | Web DB UI port (8081) |
| `MONGO_EXPRESS_USER` | Login for http://IP:8081 |
| `MONGO_EXPRESS_PASSWORD` | Password for http://IP:8081 |

### Mongo Express login

| User | Password |
|------|----------|
| `admin` | `OBEExpress2025Admin` |

If port 8081 does not load in browser, open it in firewall:

```bash
ufw allow 8081/tcp && ufw reload
```

Or **aaPanel → Security → port 8081 (TCP)**.

Start Mongo Express:

```bash
cd /www/wwwroot/obe-portal && docker-compose --profile tools up -d mongo-express
```

---

## Default logins (website)

### Pro Super Admin

| Email | Password |
|-------|----------|
| `pro@obe.org.pk` | `proadmin123` |

### University Super Admin (demo)

| Email | Password |
|-------|----------|
| `demo@demo.com` | `Admin@DEMO2025` |

Pattern for any university: `Admin@UNIVERSITYCODE2025` (code uppercase, e.g. `DEMO`).

### Demo university roles (after seed)

Run `npm run seed-demo` on the VPS (see below). All role accounts use password **`Demo@2025`**.

| Role | Email |
|------|-------|
| Dean | `dean@demo.edu` |
| Controller | `controller@demo.edu` |
| Chairman (CS) | `chairman.cs@demo.edu` |
| Focal (CS) | `focal.cs@demo.edu` |
| Teacher | `ali.raza@demo.edu` |
| Student | `hamza.akram@demo.edu` |

More accounts are created (teachers, students, chairmen for SE/BA). The seed script prints the full list.

**Seed on VPS:**

```bash
cd /www/wwwroot/obe-portal
docker compose exec obe-app npm run seed-demo
```

Or after `git pull` and rebuild: `docker compose exec obe-app node scripts/seed-demo-university.js --reset`

---

## Database architecture

Each university has a **separate** MongoDB database:

```
MongoDB
├── obe_platform      ← platform (universities, admins, subscriptions)
├── obe_university_demo ← demo university (code DEMO)
└── obe_university_*  ← one DB per university (auto-created)
```

**Connection inside Docker:**

```
mongodb://admin:SecureOBE2025MongoDBQuest@mongodb:27017/obe_platform?authSource=admin
```

**Terminal access (no 8081 needed):**

```bash
docker exec -it obe-mongodb mongosh -u admin -p SecureOBE2025MongoDBQuest --authenticationDatabase admin
```

Then: `show dbs` → `use obe_university_demo` → `show collections`

---

## First-time VPS setup

```bash
ssh root@194.60.87.212
cd /www/wwwroot
git clone https://github.com/riabha/OBE.git obe-portal
cd obe-portal
# Create .env (use one-liner above)
chmod +x update-server.sh
docker-compose up -d --build
docker-compose --profile tools up -d mongo-express
curl http://localhost:3200/api/health
```

---

## Useful VPS commands

```bash
cd /www/wwwroot/obe-portal

docker-compose ps                          # container status
docker logs obe-portal --tail 50           # app logs
docker logs obe-mongodb --tail 50          # database logs
curl -s http://localhost:3200/api/health   # must say connected
git log -1 --oneline                       # should match GitHub
```

### If `git pull` fails (local changes on server)

```bash
cd /www/wwwroot/obe-portal
git fetch origin main && git reset --hard origin/main
docker-compose up -d --build obe-app
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `"database":"disconnected"` | Check `.env` password matches original; `docker-compose restart obe-app` |
| Dashboard clicks dead / Loading… | Push latest code, rebuild: `docker-compose up -d --build obe-app`, hard refresh |
| 8081 not reachable | `docker ps \| grep mongo-express`, open firewall port 8081 |
| Login fails | See [Default logins](#default-logins-website) above |
| Changes not on live site | Did you push to GitHub first? Then `./update-server.sh` on VPS |

---

## Project files (root)

```
OBE/
├── server.js           # Main app
├── Dockerfile
├── docker-compose.yml
├── mongo-init.js
├── .env.docker         # Template (in Git)
├── .env                # Secrets (NOT in Git — local + VPS only)
├── DEPLOYMENT.md       # This file
├── deploy.ps1          # Windows: push to GitHub
├── update-server.sh    # VPS: pull + rebuild
└── public/             # Website HTML/JS/CSS
```

Legacy files: `_archive-to-delete/` (delete when no longer needed).

---

## Security checklist

- [ ] `.env` only on VPS — never commit to Git
- [ ] Change Pro Super Admin password after first login
- [ ] Port 27018 not public (already localhost-only)
- [ ] Open only: 22, 3200, 8081 (optional)

---

*Last updated: June 2026*
