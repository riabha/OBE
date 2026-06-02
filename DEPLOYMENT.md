# OBE Portal — Deployment Guide

Single reference for running and updating the OBE Portal on your Contabo VPS.

---

## Live server

| Item | Value |
|------|--------|
| **VPS IP** | `194.60.87.212` |
| **App URL** | http://194.60.87.212:3200 |
| **Login** | http://194.60.87.212:3200/login |
| **Pro Super Admin** | http://194.60.87.212:3200/pro-super-admin-dashboard.html |
| **University Super Admin** | http://194.60.87.212:3200/university-super-admin-dashboard.html |
| **GitHub** | https://github.com/riabha/OBE |
| **Server path** | `/www/wwwroot/obe-portal` |
| **Branch** | `main` |

---

## Ports

| Service | Port | Notes |
|---------|------|--------|
| OBE App | **3200** | Public — main website |
| MongoDB (external) | 27018 | Bound to localhost only on VPS |
| Mongo Express (optional) | 8081 | Not started by default — see below |

Inside Docker, the app runs on port `3000`; `docker-compose.yml` maps it to host port `3200`.

---

## Stack

- **Node.js 22** (Docker image `node:22-alpine`)
- **MongoDB 7.0** (Docker)
- **Express** + **Mongoose**
- **Docker Compose** on Linux VPS

### Root files that matter

```
OBE/
├── server.js              # Main application
├── Dockerfile
├── docker-compose.yml
├── mongo-init.js
├── .env.docker            # Template — copy to .env on server
├── config.env.example     # Template for local dev (non-Docker)
├── DEPLOYMENT.md          # This file
├── deploy.ps1             # Push changes from Windows
├── update-server.sh       # Pull + rebuild on VPS
├── public/                # Frontend HTML/JS/CSS
├── models/
├── routes/
├── middleware/
├── utils/
└── scripts/
```

Old docs and fix scripts are in `_archive-to-delete/` (safe to remove later).

---

## First-time VPS setup

SSH into the server:

```bash
ssh root@194.60.87.212
```

### 1. Clone (if not already done)

```bash
cd /www/wwwroot
git clone https://github.com/riabha/OBE.git obe-portal
cd obe-portal
```

### 2. Environment file

```bash
cp .env.docker .env
nano .env
```

Set these values in `.env`:

```env
APP_PORT=3200
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret-min-32-chars
SESSION_SECRET=your-session-secret-min-32-chars
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=your-mongo-express-password
```

Generate secrets:

```bash
openssl rand -base64 32
```

### 3. Start

```bash
docker-compose up -d --build
docker-compose ps
curl http://localhost:3200/api/health
```

Expected: `{"status":"OK","database":"connected",...}`

---

## One-command updates

### On your Windows PC (push to GitHub)

```powershell
cd d:\gitobe2June2026\OBE
.\deploy.ps1 "Describe your change here"
```

Or with npm:

```powershell
npm run deploy -- "Describe your change here"
```

This stages, commits (if there are changes), and pushes to `origin main`.

### On the VPS (pull and rebuild)

```bash
cd /www/wwwroot/obe-portal
./update-server.sh
```

Or manually:

```bash
cd /www/wwwroot/obe-portal
git pull origin main
docker-compose up -d --build obe-app
```

**Important:** Use `--build` after HTML/JS changes. A plain `docker-compose restart` does not rebuild the image.

---

## Default logins

### Pro Super Admin (platform)

| Email | Password |
|-------|----------|
| `pro@obe.org.pk` | `proadmin123` |

Change this password after first login.

### University Super Admin

Password pattern when a university is created:

```
Admin@UNIVERSITYCODE2025
```

Example — **demo** university:

| Email | Password |
|-------|----------|
| `demo@demo.com` | `Admin@DEMO2025` |

(`DEMO` must be uppercase.)

Reset via Pro Admin → Universities → Edit → Reset Super Admin Password.

---

## Database

### Architecture

- **`obe_platform`** — universities, platform users, subscriptions
- **`obe_demo`**, **`obe_university_xxx`** — one database per university

### Connection strings

**Inside Docker (app container):**

```
mongodb://admin:PASSWORD@mongodb:27017/obe_platform?authSource=admin
```

**From VPS host (localhost only):**

```
mongodb://admin:PASSWORD@127.0.0.1:27018/obe_platform?authSource=admin
```

### Backup

```bash
docker exec obe-mongodb mongodump \
  -u admin -p YOUR_PASSWORD \
  --authenticationDatabase admin \
  --out /data/db/backup-$(date +%Y%m%d)
```

---

## Mongo Express (optional web DB UI)

Not started by default. To enable:

```bash
cd /www/wwwroot/obe-portal
docker-compose --profile tools up -d mongo-express
```

Then open http://194.60.87.212:8081 (open port 8081 in firewall if needed).

Login: user/password from `.env` (`MONGO_EXPRESS_USER` / `MONGO_EXPRESS_PASSWORD`).

---

## Useful commands

```bash
# Container status
docker-compose ps

# App logs
docker logs obe-portal --tail 50 -f

# MongoDB logs
docker logs obe-mongodb --tail 50

# Health check
curl http://localhost:3200/api/health

# Restart app only (no code update)
docker-compose restart obe-app

# Full rebuild after git pull
docker-compose up -d --build obe-app

# Stop everything
docker-compose down
```

---

## Troubleshooting

### Dashboard clicks not working / stuck on "Loading..."

1. Hard refresh browser: `Ctrl + Shift + R`
2. Check browser console (F12) for JavaScript errors
3. Ensure latest code is deployed: `git log -1 --oneline` on VPS should match GitHub
4. Rebuild: `docker-compose up -d --build obe-app`

### Login fails

- Pro admin: `pro@obe.org.pk` / `proadmin123`
- University admin: `Admin@CODE2025` (CODE = university code, uppercase)
- Check API: `curl -X POST http://localhost:3200/api/auth/login -H "Content-Type: application/json" -d '{"email":"pro@obe.org.pk","password":"proadmin123"}'`

### Database disconnected

```bash
docker-compose ps          # obe-mongodb should be Up (healthy)
docker logs obe-mongodb
docker-compose restart mongodb obe-app
```

### Port 8081 not accessible

Mongo Express is optional and uses Docker profile `tools`. See [Mongo Express](#mongo-express-optional-web-db-ui) above.

---

## Local development (without Docker)

```bash
npm install
cp config.env.example config.env
# Edit config.env — set MONGODB_URI to local MongoDB
npm start
```

App runs at http://localhost:3000 (or PORT in config.env).

---

## Security checklist

- [ ] Change `MONGO_ROOT_PASSWORD` in `.env`
- [ ] Set strong `JWT_SECRET` and `SESSION_SECRET`
- [ ] Change Pro Super Admin password after first login
- [ ] Do not expose MongoDB port 27018 publicly (already bound to 127.0.0.1)
- [ ] Open only ports 22, 3200, (optional 80/443/8081) in firewall

---

*Last updated: June 2026*
