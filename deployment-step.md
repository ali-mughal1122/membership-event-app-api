# Unified Multi-Environment Deployment Architecture: TaxiTerminalen.dk

> [!IMPORTANT]
> **CRITICAL PRODUCTION RULE — ZERO DOWNTIME & DNS CUTOVER IS LAST**  
> Do **NOT** modify live A records, nameservers, or MX email records on Simply.com until the application is fully deployed, tested on Staging, and explicitly approved. The live Webnode website must remain 100% accessible throughout the entire setup.

---

## 1. High-Level Multi-Environment Architecture

We manage three distinct environments across our workflow:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ENVIRONMENT LIFECYCLE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

 1. LOCAL DEVELOPMENT (dev)             2. STAGING ON CONTABO (stage)           3. PRODUCTION ON CONTABO (prod)
 ┌──────────────────────────────┐       ┌──────────────────────────────┐       ┌──────────────────────────────┐
 │ Host: Local Laptop/PC        │       │ Host: Contabo VPS (161...)   │       │ Host: Contabo VPS (161...)   │
 │ Dir: d:\nestjs\...           │       │ Dir: /opt/taxiterminalen/stage│      │ Dir: /opt/taxiterminalen/prod │
 │ Git Branch: dev              │       │ Git Branch: dev              │       │ Git Branch: main (Approved)  │
 │ Frontend: localhost:4200     │       │ Frontend: Container (:80)    │       │ Frontend: Container (:80)    │
 │ Backend: localhost:3500/api  │       │ Backend: Container (:3500)   │       │ Backend: Container (:3500)   │
 │ Gateway: None (direct)       │       │ Gateway: Port 80 / IP access │       │ Gateway: Port 80/443 + SSL   │
 │ URL: http://localhost:4200   │       │ URL: http://161.97.184.191   │       │ URL: https://taxiterminalen.dk│
 │ DB: Local Postgres (5432)    │       │ DB: Isolated Volume (stage)  │       │ DB: Isolated Volume (prod)   │
 │ Schema: synchronize: true    │       │ Schema: synchronize: true    │       │ Schema: synchronize: false   │
 │ Simply.com DNS: Untouched    │       │ Simply.com DNS: Untouched    │       │ Simply.com DNS: LIVE CUTOVER │
 └──────────────────────────────┘       └──────────────────────────────┘       └──────────────────────────────┘
```

---

## 2. Environment Comparison Matrix

| Configuration Property | 1. Local Development (`dev`) | 2. Staging on Contabo (`stage`) | 3. Production on Contabo (`prod`) |
| :--- | :--- | :--- | :--- |
| **Physical Machine** | Developer workstation (Windows) | Contabo VPS (`161.97.184.191`) | Contabo VPS (`161.97.184.191`) |
| **Server Directory** | Local Git workspace | `/opt/taxiterminalen/stage` | `/opt/taxiterminalen/prod` |
| **Git Branch Deployed** | `dev` | `dev` | `main` (only tested commits) |
| **Compose File** | Optional (`docker-compose.dev.yml`) | `/opt/taxiterminalen/stage/docker-compose.yml` | `/opt/taxiterminalen/prod/docker-compose.yml` |
| **Env File Location** | `membership-event-app-api/.env` | `/opt/taxiterminalen/stage/.env` | `/opt/taxiterminalen/prod/.env` |
| **Frontend Public URL** | `http://localhost:4200` | `http://161.97.184.191` (or staging subdomain) | `https://taxiterminalen.dk` |
| **Angular API Base URL** | `http://localhost:3500/api/` | `http://stage.taxiterminalen.dk/api/` (or relative `/api/`) | `https://taxiterminalen.dk/api/` |
| **Angular Build Target** | `development` (`ng serve`) | `staging` (`--configuration staging`) | `production` (`--configuration production`) |
| **NestJS Database Sync** | `DB_SYNCHRONIZE=true` | `DB_SYNCHRONIZE=true` (initial bootstrap) | **`DB_SYNCHRONIZE=false`** (strictly enforced) |
| **PostgreSQL Container** | Local service or dev container | `stage-taxiterminalen-db` (isolated volume) | `prod-taxiterminalen-db` (isolated volume) |
| **SSL / HTTPS** | None | Plain HTTP on Port 80 (or self-signed) | Automatic Let's Encrypt TLS (Certbot) |
| **Email SMTP Service** | Sandbox (Mailtrap) | Sandbox (Mailtrap) | Live SMTP (`smtp.simply.com`) |
| **Simply.com DNS** | **Untouched** | **Untouched (Webnode 100% Live)** | Updated only after final sign-off |

---

## 3. Environment 1: Local Development (`dev`)

Used for daily feature programming and local testing before committing code.

### 3.1 Local Environment File (`membership-event-app-api/.env`)
```ini
PORT=3500
NODE_ENV=development

# Authentication
JWT_SECRET=dev_super_secret_jwt_key_987654321

# Local PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=snx@AB123
DB_DATABASE=mem_event_db
DB_SYNCHRONIZE=true

# Allowed CORS Origins
ALLOWED_ORIGINS=http://localhost:4200,http://localhost:4300

# Sandbox Mailer (Mailtrap)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_dev_user
SMTP_PASSWORD=your_dev_pass

FRONTEND_URL=http://localhost:4200
```

### 3.2 Running Locally
- **Backend**: `cd membership-event-app-api && npm run start:dev` (runs on `http://localhost:3500/api`)
- **Frontend**: `cd membership-event-app && npm run start` (runs on `http://localhost:4200`)
- **Push to Git**: Once tested locally, commit and push to branch `dev`:
  ```bash
  git checkout dev
  git add .
  git commit -m "feat: new feature ready for staging"
  git push origin dev
  ```

---

## 4. Environment 2: Staging on Contabo (`stage`)

Allows you to verify the application running in real Docker containers on the Contabo VPS without touching the live Webnode website or Simply.com DNS.

### 4.1 Staging Environment File (`/opt/taxiterminalen/stage/.env`)
On the Contabo VPS:
```bash
nano /opt/taxiterminalen/stage/.env
```
Populate with:
```ini
PORT=3500
NODE_ENV=staging

# Staging JWT Secret
JWT_SECRET=stage_secure_random_key_replace_me_12345

# Internal Docker Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=taxiterminalen_stage
DB_PASSWORD=YOUR_STRONG_STAGE_DB_PASSWORD
DB_DATABASE=taxiterminalen_stage
DB_SYNCHRONIZE=true

# Allowed CORS Origins (Contabo IP)
ALLOWED_ORIGINS=http://161.97.184.191,http://stage.taxiterminalen.dk

# Sandbox Mailer (Mailtrap)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_stage_mailtrap_user
SMTP_PASSWORD=your_stage_mailtrap_password

FRONTEND_URL=http://161.97.184.191
```
Set permissions:
```bash
chmod 600 /opt/taxiterminalen/stage/.env
```

---

### 4.2 Staging Docker Compose (`/opt/taxiterminalen/stage/docker-compose.yml`)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: stage-taxiterminalen-db
    restart: always
    environment:
      POSTGRES_DB: ${DB_DATABASE}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - stage_postgres_data:/var/lib/postgresql/data
    networks:
      - stage-internal-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME} -d ${DB_DATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: stage-taxiterminalen-backend
    restart: always
    env_file: .env
    environment:
      PORT: 3500
      DB_HOST: postgres
      DB_PORT: 5432
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - stage-internal-net
      - stage-proxy-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 1024M

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        CONFIGURATION: staging
    container_name: stage-taxiterminalen-frontend
    restart: always
    networks:
      - stage-proxy-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

  nginx-gateway:
    image: nginx:alpine
    container_name: stage-taxiterminalen-gateway
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - frontend
      - backend
    networks:
      - stage-proxy-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  stage-internal-net:
    internal: true
  stage-proxy-net:
    driver: bridge

volumes:
  stage_postgres_data:
    name: stage_taxiterminalen_pgdata
```

---

### 4.3 Staging Gateway Nginx (`/opt/taxiterminalen/stage/nginx/conf.d/stage.conf`)
```nginx
upstream frontend_app {
    server frontend:80;
}

upstream backend_api {
    server backend:3500;
}

server {
    listen 80;
    server_name _;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Proxy Routing
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }

    # Frontend SPA Routing
    location / {
        proxy_pass http://frontend_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 4.4 Staging Deployment & Testing Commands
On the Contabo VPS as `deployadmin`:
```bash
# 1. Clone or pull latest dev branch
cd /opt/taxiterminalen/stage
git clone -b dev https://github.com/ali-mughal1122/membership-event-app-api.git backend 2>/dev/null || (cd backend && git pull origin dev)
git clone -b dev https://github.com/ali-mughal1122/membership-event-app.git frontend 2>/dev/null || (cd frontend && git pull origin dev)

# 2. Build and launch staging
docker compose up -d --build

# 3. Check status
docker compose ps
docker compose logs -f --tail=50
```
**Verification**: Open `http://161.97.184.191` in your browser. Verify authentication, API responses, and database persistence.

---

## 5. Environment 3: Production on Contabo (`prod`)

Once the code on the `dev` branch is completely verified in Staging, it is merged into the `main` branch and deployed to Production.

### 5.1 Production Environment File (`/opt/taxiterminalen/prod/.env`)
On the Contabo VPS:
```bash
nano /opt/taxiterminalen/prod/.env
```
Populate with:
```ini
PORT=3500
NODE_ENV=production

# Production High-Entropy Secret (openssl rand -base64 48)
JWT_SECRET=REPLACE_WITH_HIGH_ENTROPY_PROD_JWT_SECRET

# Internal Docker Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=taxiterminalen_prod_user
DB_PASSWORD=REPLACE_WITH_HIGH_ENTROPY_PROD_PASSWORD
DB_DATABASE=taxiterminalen_prod
DB_SYNCHRONIZE=false

# Allowed CORS Origins (Live domains only)
ALLOWED_ORIGINS=https://taxiterminalen.dk,https://www.taxiterminalen.dk

# Production SMTP Mailer (Simply.com Mail)
SMTP_HOST=smtp.simply.com
SMTP_PORT=587
SMTP_USER=noreply@taxiterminalen.dk
SMTP_PASSWORD=REPLACE_WITH_PRODUCTION_SMTP_PASSWORD

FRONTEND_URL=https://taxiterminalen.dk
```
Set permissions:
```bash
chmod 600 /opt/taxiterminalen/prod/.env
```

---

### 5.2 Production Docker Compose (`/opt/taxiterminalen/prod/docker-compose.yml`)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: prod-taxiterminalen-db
    restart: always
    environment:
      POSTGRES_DB: ${DB_DATABASE}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - prod_postgres_data:/var/lib/postgresql/data
    networks:
      - prod-internal-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME} -d ${DB_DATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 1024M

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: prod-taxiterminalen-backend
    restart: always
    env_file: .env
    environment:
      PORT: 3500
      DB_HOST: postgres
      DB_PORT: 5432
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - prod-internal-net
      - prod-proxy-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 1024M

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        CONFIGURATION: production
    container_name: prod-taxiterminalen-frontend
    restart: always
    networks:
      - prod-proxy-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

  nginx-gateway:
    image: nginx:alpine
    container_name: prod-taxiterminalen-gateway
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - frontend
      - backend
    networks:
      - prod-proxy-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

networks:
  prod-internal-net:
    internal: true
  prod-proxy-net:
    driver: bridge

volumes:
  prod_postgres_data:
    name: prod_taxiterminalen_pgdata
```

---

### 5.3 Production Gateway Nginx (`/opt/taxiterminalen/prod/nginx/conf.d/prod.conf`)
```nginx
upstream frontend_app {
    server frontend:80;
}

upstream backend_api {
    server backend:3500;
}

# HTTP: Redirects all traffic to HTTPS and handles Let's Encrypt validation
server {
    listen 80;
    server_name taxiterminalen.dk www.taxiterminalen.dk;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS: Live Production Gateway
server {
    listen 443 ssl http2;
    server_name taxiterminalen.dk www.taxiterminalen.dk;

    ssl_certificate /etc/letsencrypt/live/taxiterminalen.dk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/taxiterminalen.dk/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API Proxy Routing
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 90;
    }

    # Frontend Single Page App Routing
    location / {
        proxy_pass http://frontend_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 6. Daily Backups & Disaster Recovery (Production)

Create automated daily backups in `/opt/taxiterminalen/prod/backups/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/taxiterminalen/prod/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/prod_backup_$TIMESTAMP.sql.gz"

# Export compressed dump from container
docker exec prod-taxiterminalen-db pg_dump -U taxiterminalen_prod_user taxiterminalen_prod | gzip > "$FILENAME"

# Prune backups older than 14 days
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
```

Schedule via cron (Runs daily at 02:00 AM):
```bash
chmod +x /opt/taxiterminalen/prod/backups/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/taxiterminalen/prod/backups/backup.sh") | crontab -
```

---

## 7. Final DNS Cutover on Simply.com (Only Upon Explicit Approval)

> [!CAUTION]
> **DO NOT PERFORM THIS UNTIL STAGING AND PRODUCTION DEPLOYMENT TESTS ARE VERIFIED.**

1. **Obtain SSL Certificate on VPS via Certbot**:
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot -d taxiterminalen.dk -d www.taxiterminalen.dk --email admin@taxiterminalen.dk --agree-tos --no-eff-email
   ```
2. **Log in to [Simply.com](https://www.simply.com/) Administration**:
   - Go to **DNS administration** for `taxiterminalen.dk`.
   - Update **ONLY** the A records:
     - `@` (root domain) &rarr; `161.97.184.191`
     - `www` &rarr; `161.97.184.191`
   - **Do NOT touch MX, SPF, DKIM, or nameserver records**.
3. **Verify Cutover**:
   ```bash
   dig +short A taxiterminalen.dk
   ```
   Open `https://taxiterminalen.dk` and verify the live production cutover. Keep Webnode available as a rollback fallback.

---

## 8. Operational Commands Reference

| Operation | Staging Command (`/opt/taxiterminalen/stage`) | Production Command (`/opt/taxiterminalen/prod`) |
| :--- | :--- | :--- |
| **Start/Build** | `docker compose up -d --build` | `docker compose up -d --build` |
| **Check Status** | `docker compose ps` | `docker compose ps` |
| **View Logs** | `docker compose logs -f --tail=100` | `docker compose logs -f --tail=100` |
| **Restart Backend** | `docker compose restart backend` | `docker compose restart backend` |
| **Stop Environment** | `docker compose down` | `docker compose down` |
| **Restore Database** | `gunzip -c BACKUP.sql.gz \| docker exec -i stage-taxiterminalen-db psql -U taxiterminalen_stage -d taxiterminalen_stage` | `gunzip -c BACKUP.sql.gz \| docker exec -i prod-taxiterminalen-db psql -U taxiterminalen_prod_user -d taxiterminalen_prod` |
