#!/bin/bash
# QUEST OBE Portal - Docker Management Commands
# Run these commands on your VPS server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🐳 QUEST OBE Portal - Docker Commands              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to show menu
show_menu() {
    echo -e "${GREEN}Available Commands:${NC}"
    echo "1.  Start all services"
    echo "2.  Stop all services"
    echo "3.  Restart all services"
    echo "4.  View logs (all)"
    echo "5.  View application logs"
    echo "6.  View MongoDB logs"
    echo "7.  Check container status"
    echo "8.  Backup database"
    echo "9.  Restore database"
    echo "10. Connect to MongoDB shell"
    echo "11. Connect to application shell"
    echo "12. Update application"
    echo "13. View resource usage"
    echo "14. Clean unused Docker resources"
    echo "15. Show MongoDB databases"
    echo "16. Check application health"
    echo "17. View environment variables"
    echo "18. Rebuild containers"
    echo "0.  Exit"
    echo ""
}

# Function to start services
start_services() {
    echo -e "${YELLOW}Starting all services...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✅ Services started!${NC}"
    docker-compose ps
}

# Function to stop services
stop_services() {
    echo -e "${YELLOW}Stopping all services...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ Services stopped!${NC}"
}

# Function to restart services
restart_services() {
    echo -e "${YELLOW}Restarting all services...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ Services restarted!${NC}"
    docker-compose ps
}

# Function to view logs
view_logs() {
    echo -e "${YELLOW}Viewing logs (Ctrl+C to exit)...${NC}"
    docker-compose logs -f
}

# Function to view app logs
view_app_logs() {
    echo -e "${YELLOW}Viewing application logs (Ctrl+C to exit)...${NC}"
    docker-compose logs -f obe-app
}

# Function to view MongoDB logs
view_mongo_logs() {
    echo -e "${YELLOW}Viewing MongoDB logs (Ctrl+C to exit)...${NC}"
    docker-compose logs -f mongodb
}

# Function to check status
check_status() {
    echo -e "${YELLOW}Container Status:${NC}"
    docker-compose ps
    echo ""
    echo -e "${YELLOW}Health Status:${NC}"
    docker inspect --format='{{.Name}}: {{.State.Health.Status}}' obe-portal 2>/dev/null || echo "Health check not available"
    docker inspect --format='{{.Name}}: {{.State.Health.Status}}' obe-mongodb 2>/dev/null || echo "Health check not available"
}

# Function to backup database
backup_database() {
    BACKUP_DIR="./backups"
    DATE=$(date +%Y%m%d_%H%M%S)
    
    echo -e "${YELLOW}Creating backup...${NC}"
    mkdir -p $BACKUP_DIR
    
    # Read password from .env
    source .env
    
    docker exec obe-mongodb mongodump \
        --uri="mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27017" \
        --out=/backup/$DATE
    
    docker cp obe-mongodb:/backup/$DATE $BACKUP_DIR/
    
    # Compress
    tar -czf $BACKUP_DIR/obe-backup-$DATE.tar.gz -C $BACKUP_DIR $DATE
    rm -rf $BACKUP_DIR/$DATE
    
    echo -e "${GREEN}✅ Backup created: $BACKUP_DIR/obe-backup-$DATE.tar.gz${NC}"
}

# Function to restore database
restore_database() {
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lh ./backups/*.tar.gz 2>/dev/null || echo "No backups found"
    echo ""
    read -p "Enter backup filename (e.g., obe-backup-20250313_120000.tar.gz): " BACKUP_FILE
    
    if [ ! -f "./backups/$BACKUP_FILE" ]; then
        echo -e "${RED}❌ Backup file not found!${NC}"
        return
    fi
    
    echo -e "${YELLOW}Restoring from backup...${NC}"
    
    # Extract
    EXTRACT_DIR=$(basename $BACKUP_FILE .tar.gz)
    tar -xzf ./backups/$BACKUP_FILE -C ./backups/
    
    # Copy to container
    docker cp ./backups/$EXTRACT_DIR obe-mongodb:/restore
    
    # Restore
    source .env
    docker exec obe-mongodb mongorestore \
        --uri="mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@localhost:27017" \
        /restore
    
    # Cleanup
    rm -rf ./backups/$EXTRACT_DIR
    
    echo -e "${GREEN}✅ Database restored!${NC}"
}

# Function to connect to MongoDB shell
mongo_shell() {
    echo -e "${YELLOW}Connecting to MongoDB shell...${NC}"
    echo -e "${BLUE}Tip: Use 'show dbs' to list databases, 'use obe_platform' to switch${NC}"
    source .env
    docker exec -it obe-mongodb mongosh -u ${MONGO_ROOT_USER} -p ${MONGO_ROOT_PASSWORD}
}

# Function to connect to app shell
app_shell() {
    echo -e "${YELLOW}Connecting to application shell...${NC}"
    docker exec -it obe-portal sh
}

# Function to update application
update_app() {
    echo -e "${YELLOW}Updating application...${NC}"
    
    # Pull latest code
    echo "Pulling latest code from Git..."
    git pull origin main
    
    # Rebuild and restart
    echo "Rebuilding containers..."
    docker-compose down
    docker-compose build --no-cache obe-app
    docker-compose up -d
    
    echo -e "${GREEN}✅ Application updated!${NC}"
    docker-compose logs -f obe-app
}

# Function to view resource usage
view_resources() {
    echo -e "${YELLOW}Resource Usage:${NC}"
    docker stats --no-stream
    echo ""
    echo -e "${YELLOW}Disk Usage:${NC}"
    docker system df
}

# Function to clean Docker resources
clean_docker() {
    echo -e "${YELLOW}Cleaning unused Docker resources...${NC}"
    docker system prune -f
    echo -e "${GREEN}✅ Cleanup complete!${NC}"
}

# Function to show databases
show_databases() {
    echo -e "${YELLOW}MongoDB Databases:${NC}"
    source .env
    docker exec obe-mongodb mongosh -u ${MONGO_ROOT_USER} -p ${MONGO_ROOT_PASSWORD} \
        --eval "db.adminCommand('listDatabases')" --quiet
}

# Function to check health
check_health() {
    echo -e "${YELLOW}Checking application health...${NC}"
    curl -s http://localhost:3000/api/health | jq . || curl -s http://localhost:3000/api/health
    echo ""
}

# Function to view environment
view_env() {
    echo -e "${YELLOW}Environment Variables (from .env):${NC}"
    cat .env | grep -v "PASSWORD" | grep -v "SECRET"
    echo -e "${BLUE}(Passwords and secrets hidden for security)${NC}"
}

# Function to rebuild containers
rebuild_containers() {
    echo -e "${YELLOW}Rebuilding all containers...${NC}"
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    echo -e "${GREEN}✅ Containers rebuilt!${NC}"
    docker-compose ps
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter your choice [0-18]: " choice
    echo ""
    
    case $choice in
        1) start_services ;;
        2) stop_services ;;
        3) restart_services ;;
        4) view_logs ;;
        5) view_app_logs ;;
        6) view_mongo_logs ;;
        7) check_status ;;
        8) backup_database ;;
        9) restore_database ;;
        10) mongo_shell ;;
        11) app_shell ;;
        12) update_app ;;
        13) view_resources ;;
        14) clean_docker ;;
        15) show_databases ;;
        16) check_health ;;
        17) view_env ;;
        18) rebuild_containers ;;
        0) echo -e "${GREEN}Goodbye!${NC}"; exit 0 ;;
        *) echo -e "${RED}Invalid option!${NC}" ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    clear
done
