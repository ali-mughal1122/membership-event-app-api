#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/taxiterminalen/prod/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/prod_backup_$TIMESTAMP.sql.gz"

# Source prod environment variables if .env exists
if [ -f /opt/taxiterminalen/prod/.env ]; then
  export $(grep -v '^#' /opt/taxiterminalen/prod/.env | xargs)
fi

DB_USER=${DB_USERNAME:-taxiterminalen_prod_user}
DB_NAME=${DB_DATABASE:-taxiterminalen_prod}
CONTAINER_NAME="prod-taxiterminalen-db"

# Check if production container is running
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
  echo "[$(date)] Starting backup of $DB_NAME..."
  docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILENAME"
  chmod 600 "$FILENAME"
  echo "[$(date)] Backup completed successfully: $FILENAME ($(du -h "$FILENAME" | cut -f1))"
else
  echo "[$(date)] Production DB container $CONTAINER_NAME is not currently running. Skipping backup."
fi

# Retention: Delete backups older than 14 days
find "$BACKUP_DIR" -type f -name "prod_backup_*.sql.gz" -mtime +14 -delete
