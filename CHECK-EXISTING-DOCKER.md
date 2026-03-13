# 🔍 Check Existing Docker Setup

## Commands to Run on Your Contabo Server

Please run these commands and share the output so I can configure the OBE Portal to work alongside your existing setup:

### 1. Current Containers
```bash
docker ps -a
```

### 2. Docker Networks
```bash
docker network ls
```

### 3. Docker Volumes
```bash
docker volume ls
```

### 4. Port Usage
```bash
sudo netstat -tlnp | grep LISTEN
```

### 5. Docker Compose Files (if any)
```bash
find /opt -name "docker-compose.yml" -o -name "docker-compose.yaml" 2>/dev/null
find /home -name "docker-compose.yml" -o -name "docker-compose.yaml" 2>/dev/null
find /root -name "docker-compose.yml" -o -name "docker-compose.yaml" 2>/dev/null
```

### 6. Current Working Directory Structure
```bash
ls -la /opt/
ls -la /home/
```

### 7. Docker Images
```bash
docker images
```

### 8. System Resources
```bash
df -h
free -h
```

## What I Need to Know

Based on your output, I'll configure:

1. **Port Configuration**
   - Your existing site: localhost:3100
   - OBE Portal: localhost:3200 ✅
   - MongoDB: Internal port (not exposed)

2. **Network Isolation**
   - Create separate Docker network for OBE Portal
   - Ensure no conflicts with existing networks

3. **Volume Management**
   - Separate volumes for OBE Portal data
   - No interference with existing volumes

4. **Resource Allocation**
   - Ensure sufficient resources available
   - Configure appropriate limits

## Expected Configuration

Based on your requirements:

```yaml
# OBE Portal Configuration
services:
  obe-app:
    ports:
      - "3200:3000"  # Your requested port
    networks:
      - obe-network  # Isolated network
  
  obe-mongodb:
    ports:
      - "127.0.0.1:27018:27017"  # Internal MongoDB port
    networks:
      - obe-network  # Same isolated network
```

This ensures:
- ✅ Your existing website (port 3100) remains untouched
- ✅ OBE Portal runs on port 3200 as requested
- ✅ MongoDB uses internal port 27018 (not conflicting)
- ✅ Completely isolated Docker network
- ✅ Separate volumes and containers

## Next Steps

After you share the output:
1. I'll customize the Docker configuration
2. Update port mappings
3. Ensure network isolation
4. Test deployment without affecting existing setup
5. Provide deployment commands specific to your environment

Please run the commands above and share the output!