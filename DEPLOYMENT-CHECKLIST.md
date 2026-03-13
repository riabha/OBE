# ✅ Docker Deployment Checklist

## Pre-Deployment (On Your Local Machine)

- [ ] All code committed to Git
- [ ] `.env.docker` template created
- [ ] Docker files created (Dockerfile, docker-compose.yml)
- [ ] Documentation reviewed
- [ ] Backup of current data (if migrating)

---

## VPS Preparation

### 1. System Requirements

- [ ] VPS with at least 2GB RAM
- [ ] 20GB+ free disk space
- [ ] Ubuntu 20.04+ or similar Linux distribution
- [ ] Root or sudo access
- [ ] SSH access configured

### 2. Install Docker

```bash
# Check if Docker is installed
docker --version

# If not installed:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] User added to docker group

---

## File Upload

### Option A: Git (Recommended)

```bash
cd /opt
git clone https://github.com/yourusername/OBE.git
cd OBE
```

- [ ] Repository cloned
- [ ] All files present

### Option B: SCP

```bash
# From local machine
scp -r /path/to/OBE user@vps-ip:/opt/
```

- [ ] Files uploaded
- [ ] Permissions correct

---

## Configuration

### 1. Environment Variables

```bash
cd /opt/OBE
cp .env.docker .env
nano .env
```

**Required values:**

- [ ] `MONGO_ROOT_USER` set
- [ ] `MONGO_ROOT_PASSWORD` set (strong password)
- [ ] `JWT_SECRET` set (32+ characters)
- [ ] `SESSION_SECRET` set (32+ characters)
- [ ] `APP_PORT` set (default: 3000)

**Generate secrets:**
```bash
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For SESSION_SECRET
```

### 2. File Permissions

```bash
chmod +x docker-commands.sh
chmod 600 .env  # Protect sensitive file
```

- [ ] Scripts executable
- [ ] .env file protected

---

## Deployment

### 1. Start Services

```bash
docker-compose up -d
```

- [ ] Containers started
- [ ] No errors in output

### 2. Wait for Services

```bash
# Wait 30 seconds for MongoDB to initialize
sleep 30
```

- [ ] Waited for initialization

### 3. Check Status

```bash
docker-compose ps
```

**Expected output:**
```
NAME            STATUS          PORTS
obe-mongodb     Up (healthy)    27017/tcp
obe-portal      Up (healthy)    0.0.0.0:3000->3000/tcp
```

- [ ] All containers running
- [ ] All containers healthy

---

## Verification

### 1. Application Health

```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "OK",
  "message": "QUEST OBE Portal - Production Version",
  "database": "connected"
}
```

- [ ] Health check passes
- [ ] Database connected

### 2. MongoDB Connection

```bash
docker exec obe-mongodb mongosh --eval "db.adminCommand('ping')"
```

**Expected response:**
```
{ ok: 1 }
```

- [ ] MongoDB responding
- [ ] Authentication working

### 3. View Logs

```bash
docker-compose logs --tail=50 obe-app
```

- [ ] No error messages
- [ ] Application started successfully
- [ ] MongoDB connection confirmed

### 4. Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@obe.org.pk","password":"proadmin123"}'
```

- [ ] Login successful
- [ ] Token received

---

## Security Configuration

### 1. Firewall Setup

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

- [ ] Firewall enabled
- [ ] Only necessary ports open
- [ ] MongoDB port (27017) NOT exposed

### 2. Change Default Password

- [ ] Login to application
- [ ] Change pro@obe.org.pk password
- [ ] Test new password

### 3. Verify Security

```bash
# Check MongoDB is not exposed
sudo netstat -tlnp | grep 27017
# Should show 127.0.0.1:27017 or docker network only

# Check application port
sudo netstat -tlnp | grep 3000
# Should show 0.0.0.0:3000 or specific IP
```

- [ ] MongoDB not publicly accessible
- [ ] Application accessible on correct port

---

## Domain Setup (Optional)

### 1. DNS Configuration

In your domain registrar:
- [ ] A record: @ → VPS IP
- [ ] A record: www → VPS IP
- [ ] DNS propagated (check with `dig your-domain.com`)

### 2. Nginx Installation

```bash
sudo apt update
sudo apt install nginx
```

- [ ] Nginx installed
- [ ] Nginx running

### 3. Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/obe-portal
# Copy content from nginx-config-example.conf

sudo ln -s /etc/nginx/sites-available/obe-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

- [ ] Nginx configured
- [ ] Configuration valid
- [ ] Nginx reloaded

### 4. SSL Certificate

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] HTTPS working

---

## Backup Configuration

### 1. Create Backup Script

```bash
sudo nano /opt/backup-obe.sh
# Copy content from DOCKER-DEPLOYMENT-GUIDE.md

chmod +x /opt/backup-obe.sh
```

- [ ] Backup script created
- [ ] Script executable

### 2. Test Backup

```bash
/opt/backup-obe.sh
ls -lh /opt/backups/obe/
```

- [ ] Backup runs successfully
- [ ] Backup file created

### 3. Schedule Backups

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-obe.sh") | crontab -
crontab -l
```

- [ ] Cron job added
- [ ] Backup scheduled (daily at 2 AM)

---

## Monitoring Setup

### 1. Log Rotation

```bash
# Docker handles log rotation automatically
# Verify in docker-compose.yml:
cat docker-compose.yml | grep -A 3 "logging:"
```

- [ ] Log rotation configured
- [ ] Max size: 10MB
- [ ] Max files: 3

### 2. Resource Monitoring

```bash
docker stats --no-stream
```

- [ ] Can view resource usage
- [ ] Containers within limits

---

## Testing

### 1. Functional Tests

- [ ] Login with default credentials
- [ ] Change default password
- [ ] Create test university
- [ ] Verify university database created
- [ ] Login as university admin
- [ ] Create test department
- [ ] Create test user
- [ ] Upload test file
- [ ] Generate test report

### 2. Performance Tests

```bash
# Response time
time curl http://localhost:3000/api/health

# Load test (optional)
ab -n 100 -c 10 http://localhost:3000/api/health
```

- [ ] Response time acceptable (<100ms)
- [ ] Can handle concurrent requests

### 3. Data Verification

```bash
# Check databases
docker exec obe-mongodb mongosh -u admin -p \
  --eval "show dbs"

# Check platform users
docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.platformusers.countDocuments()"

# Check universities
docker exec obe-mongodb mongosh -u admin -p obe_platform \
  --eval "db.universities.countDocuments()"
```

- [ ] Platform database exists
- [ ] Collections created
- [ ] Data accessible

---

## Documentation

- [ ] Document VPS IP address
- [ ] Document domain name (if used)
- [ ] Document MongoDB credentials (secure location)
- [ ] Document JWT secrets (secure location)
- [ ] Document backup location
- [ ] Document any custom configurations

---

## Post-Deployment

### 1. Notify Team

- [ ] Share application URL
- [ ] Share login credentials (securely)
- [ ] Share documentation links

### 2. Monitor for 24 Hours

- [ ] Check logs regularly
- [ ] Monitor resource usage
- [ ] Watch for errors
- [ ] Test major features

### 3. Create Runbook

Document:
- [ ] How to restart services
- [ ] How to view logs
- [ ] How to backup/restore
- [ ] Emergency contacts
- [ ] Troubleshooting steps

---

## Maintenance Schedule

### Daily
- [ ] Check application health
- [ ] Review error logs
- [ ] Verify backups completed

### Weekly
- [ ] Review resource usage
- [ ] Check disk space
- [ ] Test backup restore
- [ ] Review security logs

### Monthly
- [ ] Update Docker images
- [ ] Review and rotate logs
- [ ] Test disaster recovery
- [ ] Update documentation

---

## Emergency Contacts

**System Administrator:**
- Name: _______________
- Email: _______________
- Phone: _______________

**Database Administrator:**
- Name: _______________
- Email: _______________
- Phone: _______________

**Hosting Provider:**
- Provider: _______________
- Support: _______________
- Account: _______________

---

## Rollback Plan

If deployment fails:

1. **Stop Docker containers:**
   ```bash
   docker-compose down
   ```

2. **Restore previous setup:**
   ```bash
   # Restore old application
   # Restore old database
   ```

3. **Verify old setup works:**
   ```bash
   # Test old application
   ```

- [ ] Rollback plan documented
- [ ] Rollback tested

---

## Sign-Off

**Deployment completed by:** _______________

**Date:** _______________

**Verified by:** _______________

**Date:** _______________

---

**Made with ❤️ for QUEST University**

**Status:** Ready for Production ✅
