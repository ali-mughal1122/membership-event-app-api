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
  echo "[$(date)] Database backup completed successfully: $FILENAME ($(du -h "$FILENAME" | cut -f1))"
else
  echo "[$(date)] Production DB container $CONTAINER_NAME is not currently running. Skipping DB backup."
fi

# Backup user uploads if directory exists
UPLOADS_DIR="/opt/taxiterminalen/prod/uploads"
if [ -d "$UPLOADS_DIR" ]; then
  UPLOADS_FILENAME="$BACKUP_DIR/prod_uploads_$TIMESTAMP.tar.gz"
  echo "[$(date)] Starting backup of user uploads from $UPLOADS_DIR..."
  tar -czf "$UPLOADS_FILENAME" -C "/opt/taxiterminalen/prod" uploads
  chmod 600 "$UPLOADS_FILENAME"
  echo "[$(date)] Uploads backup completed successfully: $UPLOADS_FILENAME ($(du -h "$UPLOADS_FILENAME" | cut -f1))"
fi

# Retention: Delete backups older than 14 days
find "$BACKUP_DIR" -type f \( -name "prod_backup_*.sql.gz" -o -name "prod_uploads_*.tar.gz" \) -mtime +14 -delete
