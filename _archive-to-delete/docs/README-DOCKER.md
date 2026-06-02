# 🐳 Docker Deployment - Quick Reference

## 🚀 One-Command Deployment

```bash
# On your VPS
cd /opt/OBE
cp .env.docker .env
nano .env  # Set passwords
docker-compose up -d
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds Node.js app container |
| `docker-compose.yml` | Orchestrates all services |
| `.env` | Environment variables (create from .env.docker) |
| `mongo-init.js` | Initializes MongoDB |
| `docker-commands.sh` | Interactive management script |

---

## 🔧 Essential Commands

### Start/Stop

```bash
docker-compose up -d        # Start all services
docker-compose down         # Stop all services
docker-compose restart      # Restart all services
```

### Logs

```bash
docker-compose logs -f              # All logs
docker-compose logs -f obe-app      # App logs only
docker-compose logs -f mongodb      # MongoDB logs only
```

### Status

```bash
docker-compose ps           # Container status
docker stats --no-stream    # Resource usage
curl http://localhost:3000/api/health  # Health check
```

### Database

```bash
# Connect to MongoDB shell
docker exec -it obe-mongodb mongosh -u admin -p

# Backup
docker exec obe-mongodb mongodump --uri="mongodb://admin:pass@localhost:27017" --out=/backup

# Restore
docker exec obe-mongodb mongorestore --uri="mongodb://admin:pass@localhost:27017" /restore
```

---

## 🌐 Access

**Application:** `http://your-vps-ip:3000`

**Default Login:**
- Email: `pro@obe.org.pk`
- Password: `proadmin123`

---

## 📊 Architecture

```
┌─────────────────────────────────────┐
│         Docker Host (VPS)           │
│                                     │
│  ┌──────────┐      ┌──────────┐   │
│  │ obe-app  │─────▶│ mongodb  │   │
│  │ :3000    │      │ :27017   │   │
│  └──────────┘      └──────────┘   │
│                                     │
│  Volumes:                          │
│  • mongodb_data                    │
│  • app_uploads                     │
└─────────────────────────────────────┘
```

---

## 🔐 Security

**Must Change:**
- [ ] `MONGO_ROOT_PASSWORD` in .env
- [ ] `JWT_SECRET` in .env
- [ ] `SESSION_SECRET` in .env
- [ ] Default admin password after first login

**Firewall:**
```bash
sudo ufw allow 22,80,443/tcp
sudo ufw enable
```

---

## 📖 Full Documentation

- `DEPLOYMENT-SUMMARY.md` - Complete overview
- `DOCKER-DEPLOYMENT-GUIDE.md` - Detailed guide
- `QUICK-START.md` - Fast deployment
- `MIGRATION-FROM-EXISTING.md` - Migration guide

---

## 🆘 Troubleshooting

**App won't start:**
```bash
docker-compose logs obe-app
```

**MongoDB connection failed:**
```bash
docker-compose logs mongodb
docker exec obe-mongodb mongosh --eval "db.adminCommand('ping')"
```

**Can't access from browser:**
```bash
curl http://localhost:3000/api/health
sudo ufw status
```

---

## 📞 Support

Run diagnostics:
```bash
docker-compose ps
docker-compose logs --tail=50
curl http://localhost:3000/api/health
```

---

**Made with ❤️ for QUEST University**
