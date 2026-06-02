# OBE Portal

Outcome-Based Education (OBE) management system for universities — CLOs, assessments, results, multi-tenant MongoDB, role-based dashboards.

**Live site:** http://194.60.87.212:3200

---

## Quick links

| Doc | Purpose |
|-----|---------|
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Server setup, credentials, Docker, one-command deploy |
| `deploy.ps1` | Push changes from Windows → GitHub |
| `update-server.sh` | Pull + rebuild on VPS |

---

## Deploy workflow (order matters)

**1. Windows — push to GitHub first:**

```powershell
.\deploy.ps1 "Your change description"
```

**2. VPS — pull and rebuild:**

```bash
cd /www/wwwroot/obe-portal && ./update-server.sh
```

**3. Browser — hard refresh:** `Ctrl + Shift + R`

Full guide (`.env`, logins, Mongo Express, troubleshooting): **[DEPLOYMENT.md](./DEPLOYMENT.md)**

---

## Local development

```bash
npm install
cp config.env.example config.env
npm start
```

---

## Repository

https://github.com/riabha/OBE

Legacy docs and old fix scripts are in `_archive-to-delete/` (safe to delete when no longer needed).
