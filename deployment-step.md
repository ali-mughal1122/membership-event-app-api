# Multi-Environment Deployment Architecture: TaxiTerminalen.dk (Dev, Stage, Prod)

> [!IMPORTANT]
> **CRITICAL REQUIREMENT — ZERO DOWNTIME & DNS CUTOVER IS LAST**  
> Do **NOT** change the live A record, nameservers, or any DNS records on Simply.com until the application is fully deployed, tested, and approved on Contabo. The live Webnode website must remain 100% operational throughout this entire process.

---

## Architecture & Multi-Environment Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ENVIRONMENT LIFECYCLE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
          DEV (Local Machine)                  STAGE (Contabo Testing)                  PROD (Live Cutover)
   ┌──────────────────────────────┐        ┌──────────────────────────────┐       ┌──────────────────────────────┐
   │ • Host: localhost            │        │ • Host: CONTABO_IP or        │       │ • Host: taxiterminalen.dk    │
   │ • Frontend: :4200            │        │   stage.taxiterminalen.dk    │       │   www.taxiterminalen.dk      │
   │ • Backend: :3500             │        │ • Reverse Proxy (Nginx)      │       │ • Reverse Proxy (Nginx)      │
   │ • DB: localhost:5432         │        │ • DB: Internal Docker network│       │ • DB: Internal Docker network│
   │ • Schema: synchronize: true  │        │ • Schema: Initial sync/seed  │       │ • Schema: synchronize: false │
   │ • Live Webnode: UNTOUCHED    │        │ • Live Webnode: UNTOUCHED    │       │ • Live Webnode: CUTOVER DONE │
   └──────────────────────────────┘        └──────────────────────────────┘       └──────────────────────────────┘
```

### Complete Environment Comparison Matrix

| Property | Development (`dev`) | Staging (`stage`) | Production (`prod`) |
| :--- | :--- | :--- | :--- |
| **Hosting Location** | Local workstation / laptop | Contabo VPS (Isolated test network/ports) | Contabo VPS (Live public ports 80/443) |
| **Frontend URL** | `http://localhost:4200` | `http://YOUR_CONTABO_IP` (or test subdomain) | `https://taxiterminalen.dk` |
| **Backend API URL** | `http://localhost:3500/` | `/api/` (proxied by Nginx) | `/api/` (proxied by Nginx) |
| **API Docs (Swagger)** | Enabled (`http://localhost:3500/api/docs`) | Enabled (Protected or internal) | Disabled or restricted |
| **TypeORM `synchronize`** | `true` (rapid local development) | `true` only on initial setup, then `false` | **`false`** (strictly enforced) |
| **CORS Origins** | `http://localhost:4200`, `http://localhost:4300` | `http://YOUR_CONTABO_IP`, `http://stage.taxiterminalen.dk` | `https://taxiterminalen.dk`, `https://www.taxiterminalen.dk` |
| **Database Exposure** | Exposed on `localhost:5432` | Internal Docker network only | Internal Docker network only |
| **SSL / HTTPS** | None (plain HTTP) | Plain HTTP / self-signed / staging cert | Let's Encrypt automated TLS certificate |
| **Mail Delivery** | Sandbox (Mailtrap) | Sandbox (Mailtrap) | Production SMTP (e.g., Simply.com SMTP) |
| **Docker Log Limits** | Default | `max-size: "10m"`, `max-file: "3"` | `max-size: "10m"`, `max-file: "5"` |
| **Simply.com DNS** | Untouched | **Untouched** (100% safety) | Updated only after final sign-off |

---

## Prerequisite Application Code Adjustments

Before deploying to Stage or Prod, make these two crucial standardizations in the source code:

### 1. Angular Multi-Environment Support
In your Angular application, create environment files so the API endpoint switches cleanly between Dev, Stage, and Prod:

#### A. Development: `d:\ng-projects\membership-event-app\src\environments\environment.ts`
```typescript
import { AppEndpoints } from '../app/core/endpoints';

export const environment = {
  production: false,
  environmentName: 'development',
  apiVer: 'api',
  api: {
    baseUrl: 'http://localhost:3500/',
    apiVersion: ''
  },
  endpoints: [...AppEndpoints]
};
```

#### B. Production / Staging: `d:\ng-projects\membership-event-app\src\environments\environment.prod.ts`
> [!TIP]
> By using a relative base URL (`/`), the frontend container seamlessly sends all API requests to the Nginx reverse proxy on the same origin (`/api/...`), completely eliminating CORS issues and IP hardcoding.

```typescript
import { AppEndpoints } from '../app/core/endpoints';

export const environment = {
  production: true,
  environmentName: 'production',
  apiVer: 'api',
  api: {
    baseUrl: '/',
    apiVersion: ''
  },
  endpoints: [...AppEndpoints]
};
```

#### C. Register in `angular.json`
Under `projects -> membership-event-app -> architect -> build -> configurations -> production`, ensure `fileReplacements` is added:
```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  "budgets": [...]
}
```

---

### 2. NestJS Database & Security Production Hardening

In `d:\nestjs\membership-event-app-api\src\app.module.ts`:
Change the TypeORM configuration to dynamically read `DB_SYNCHRONIZE` from the environment:
```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    autoLoadEntities: true,
    synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true', // Safe! Defaults to false in prod
  }),
  inject: [ConfigService],
}),
```

In `d:\nestjs\membership-event-app-api\src\main.ts`:
Harden CORS origins:
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:4200'];

app.enableCors({
  origin: allowedOrigins,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
});
```

---

## Detailed Step-by-Step Deployment Workflow

---

## Phase 1: Environment Files Configuration (Dev, Stage, Prod)

Create the corresponding environment files:

### 1.1 Development (`membership-event-app-api/.env.dev`)
```ini
PORT=3500
NODE_ENV=development
JWT_SECRET=dev_super_secret_jwt_key_12345
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=mem_event_db
DB_SYNCHRONIZE=true
ALLOWED_ORIGINS=http://localhost:4200,http://localhost:4300
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_dev_user
SMTP_PASSWORD=your_dev_pass
FRONTEND_URL=http://localhost:4200
```

### 1.2 Staging on Contabo (`/opt/taxiterminalen/stage/.env`)
```ini
PORT=3500
NODE_ENV=staging
JWT_SECRET=GENERATE_RANDOM_STAGE_JWT_SECRET
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=taxiterminalen_stage
DB_PASSWORD=GENERATE_STRONG_STAGE_DB_PASS
DB_DATABASE=taxiterminalen_stage
DB_SYNCHRONIZE=true
ALLOWED_ORIGINS=http://YOUR_CONTABO_IP,http://stage.taxiterminalen.dk
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_test_user
SMTP_PASSWORD=your_test_pass
FRONTEND_URL=http://YOUR_CONTABO_IP
```

### 1.3 Production on Contabo (`/opt/taxiterminalen/prod/.env`)
```ini
PORT=3500
NODE_ENV=production
JWT_SECRET=GENERATE_RANDOM_PROD_JWT_SECRET_MIN_64_CHARS
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=taxiterminalen_prod_user
DB_PASSWORD=GENERATE_HIGH_ENTROPY_PASSWORD
DB_DATABASE=taxiterminalen_prod
DB_SYNCHRONIZE=false
ALLOWED_ORIGINS=https://taxiterminalen.dk,https://www.taxiterminalen.dk
SMTP_HOST=smtp.simply.com
SMTP_PORT=587
SMTP_USER=noreply@taxiterminalen.dk
SMTP_PASSWORD=REAL_PRODUCTION_SMTP_PASSWORD
FRONTEND_URL=https://taxiterminalen.dk
```

---

## Phase 2: Prepare the Contabo VPS (Server Hardening)

Log into your Contabo VPS:
```bash
ssh root@YOUR_CONTABO_IP
```

### Step 2.1: System Updates & Security Packages
```bash
apt update && apt upgrade -y
apt install -y curl wget git ufw htop unattended-upgrades fail2ban ca-certificates gnupg apache2-utils
```

### Step 2.2: Setup Dedicated Non-Root User
```bash
adduser deployer
usermod -aG sudo deployer

# Authorize SSH key for deployer
mkdir -p /home/deployer/.ssh
cp /root/.ssh/authorized_keys /home/deployer/.ssh/ 2>/dev/null || true
chown -R deployer:deployer /home/deployer/.ssh
chmod 700 /home/deployer/.ssh
chmod 600 /home/deployer/.ssh/authorized_keys 2>/dev/null || true
```

### Step 2.3: Configure Strict UFW Firewall
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
```

### Step 2.4: Install Docker Engine & Docker Compose Plugin
```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Grant deployer permission to run docker without sudo
usermod -aG docker deployer
systemctl enable docker
systemctl start docker
```

### Step 2.5: Create Staging & Production Directory Trees
```bash
mkdir -p /opt/taxiterminalen/{stage,prod}
mkdir -p /opt/taxiterminalen/prod/{backend,frontend,nginx,backups,ssl}
mkdir -p /opt/taxiterminalen/stage/{backend,frontend,nginx}
chown -R deployer:deployer /opt/taxiterminalen
chmod -R 775 /opt/taxiterminalen
```

---

## Phase 3: Dockerize Frontend & Backend

### Step 3.1: Backend Multi-Stage Dockerfile (`membership-event-app-api/Dockerfile`)
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Stage 2: Production Minimal Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: non-root user
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 3500

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3500/api/docs || exit 1

CMD ["node", "dist/main"]
```

### Step 3.2: Frontend Multi-Stage Dockerfile (`membership-event-app/Dockerfile`)
```dockerfile
# Stage 1: Build Angular Application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Stage 2: High Performance Nginx Static Server
FROM nginx:alpine AS runner

# Security: Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist/membership-event-app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### Step 3.3: Frontend Nginx Configuration (`membership-event-app/nginx.conf`)
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # SPA routing fallback (redirects all routes to index.html)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets cache control (1 year immutable)
    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc|woff|woff2|ttf)$ {
        expires 1y;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

---

## Phase 4: Production Docker Compose Configuration

Create `/opt/taxiterminalen/prod/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: taxiterminalen-db
    restart: always
    environment:
      POSTGRES_DB: ${DB_DATABASE}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal-net
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
    container_name: taxiterminalen-backend
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
      - internal-net
      - proxy-net
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
    container_name: taxiterminalen-frontend
    restart: always
    networks:
      - proxy-net
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
    container_name: taxiterminalen-gateway
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
      - proxy-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

networks:
  internal-net:
    internal: true
  proxy-net:
    driver: bridge

volumes:
  postgres_data:
    name: taxiterminalen_prod_pgdata
```

---

## Phase 5: Nginx Gateway & Security Headers

Create `/opt/taxiterminalen/prod/nginx/conf.d/taxiterminalen.conf`:

```nginx
upstream frontend_app {
    server frontend:80;
}

upstream backend_api {
    server backend:3500;
}

# HTTP: Handles ACME challenges & redirects / staging access
server {
    listen 80;
    server_name taxiterminalen.dk www.taxiterminalen.dk _;

    # Let's Encrypt verification path
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

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

    # Frontend Single Page App Routing
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

## Phase 6: Stage Deployment & Verification (Without Modifying DNS)

> [!NOTE]
> This phase confirms everything works on the Contabo server while the live Webnode site continues serving public visitors undisturbed.

### Step 6.1: Start Services on Contabo
From `/opt/taxiterminalen/prod`:
```bash
docker compose up -d --build
```

### Step 6.2: Verify Health
```bash
docker compose ps
docker compose logs -f --tail=50
```

### Step 6.3: Testing via Local Hosts File
On your local computer (e.g. your Windows machine):
1. Open PowerShell or Notepad as **Administrator**.
2. Edit `C:\Windows\System32\drivers\etc\hosts`.
3. Add this line:
   ```
   YOUR_CONTABO_IP  taxiterminalen.dk www.taxiterminalen.dk
   ```
4. Flush your local DNS cache:
   ```powershell
   ipconfig /flushdns
   ```
5. Open your browser and navigate to `http://taxiterminalen.dk`:
   - [ ] Angular frontend renders cleanly.
   - [ ] Authentication / API login works against the NestJS backend.
   - [ ] Refreshing nested pages (e.g., `/events`, `/plans`) does not cause 404s.
   - [ ] Data persists in PostgreSQL after `docker compose restart`.
6. Once verified, delete or comment out the line in your local `hosts` file.

---

## Phase 7: GitHub Actions CI/CD with Self-Hosted Runner

### Step 7.1: Register Self-Hosted Runner on Contabo
On the Contabo VPS as user `deployer`:
```bash
mkdir -p /home/deployer/actions-runner && cd /home/deployer/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# Register runner with token from GitHub: Settings -> Actions -> Runners -> New runner
./config.sh --url https://github.com/ali-mughal1122/membership-event-app-api --token YOUR_TOKEN --labels contabo-vps --unattended

sudo ./svc.sh install deployer
sudo ./svc.sh start
```

### Step 7.2: Workflow File (`.github/workflows/deploy.yml`)
Add to both backend and frontend repositories:
```yaml
name: Production Continuous Deployment

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: [self-hosted, contabo-vps]
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Pull and Deploy
        run: |
          cd /opt/taxiterminalen/prod
          git pull origin main || true
          docker compose build --no-cache
          docker compose up -d --remove-orphans
          docker image prune -f

      - name: Health Verification
        run: |
          sleep 10
          docker compose -f /opt/taxiterminalen/prod/docker-compose.yml ps
```

---

## Phase 8: Automated Backups & Disaster Recovery

### Step 8.1: Daily Backup Script
Create `/opt/taxiterminalen/prod/backups/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/taxiterminalen/prod/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

# Export dump from container
docker exec taxiterminalen-db pg_dump -U taxiterminalen_prod_user taxiterminalen_prod | gzip > "$FILENAME"

# Delete backups older than 14 days
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
```

Make executable & schedule daily 02:00 AM cronjob:
```bash
chmod +x /opt/taxiterminalen/prod/backups/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/taxiterminalen/prod/backups/backup.sh") | crontab -
```

### Step 8.2: Emergency Restore Procedure
```bash
gunzip -c /opt/taxiterminalen/prod/backups/LATEST_BACKUP.sql.gz | docker exec -i taxiterminalen-db psql -U taxiterminalen_prod_user -d taxiterminalen_prod
```

---

## Phase 9: Final Simply.com DNS Cutover (Only Upon Explicit Approval)

> [!CAUTION]
> **DO NOT PERFORM THIS STEP UNTIL PHASES 1 THROUGH 8 ARE VERIFIED AND SIGNED OFF.**

### Step 9.1: Pre-Cutover Checklist
- [ ] Application verified via local hosts testing.
- [ ] Database backup taken and restore verified.
- [ ] Existing Simply.com DNS records exported/screenshotted.
- [ ] Existing MX, SPF, DKIM records preserved.

### Step 9.2: Obtain SSL Certificate
On Contabo VPS:
```bash
apt install -y certbot
certbot certonly --webroot -w /var/www/certbot -d taxiterminalen.dk -d www.taxiterminalen.dk --email admin@taxiterminalen.dk --agree-tos --no-eff-email
```

### Step 9.3: Update Simply.com DNS Records
1. Log in to [Simply.com Control Panel](https://www.simply.com/).
2. Go to **DNS administration** for `taxiterminalen.dk`.
3. Update **ONLY** these A records:
   - Host `@` (or `taxiterminalen.dk`) &rarr; Change IP to `YOUR_CONTABO_IP`
   - Host `www` (or `www.taxiterminalen.dk`) &rarr; Change IP to `YOUR_CONTABO_IP`
4. **DO NOT MODIFY**:
   - `MX` records (Email services)
   - `TXT` records (SPF, DKIM, DMARC)
   - Nameservers

### Step 9.4: Enable HTTPS in Nginx Gateway
Update `/opt/taxiterminalen/prod/nginx/conf.d/taxiterminalen.conf` to add the HTTPS block:
```nginx
server {
    listen 443 ssl http2;
    server_name taxiterminalen.dk www.taxiterminalen.dk;

    ssl_certificate /etc/letsencrypt/live/taxiterminalen.dk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/taxiterminalen.dk/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location /api/ {
        proxy_pass http://backend_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://frontend_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```
Reload Nginx:
```bash
docker exec taxiterminalen-gateway nginx -s reload
```

---

## Phase 10: Operational Commands Quick Reference

| Operational Task | Command |
| :--- | :--- |
| **Check service status** | `docker compose -f /opt/taxiterminalen/prod/docker-compose.yml ps` |
| **View live logs** | `docker compose -f /opt/taxiterminalen/prod/docker-compose.yml logs -f --tail=100` |
| **Restart specific service** | `docker compose -f /opt/taxiterminalen/prod/docker-compose.yml restart backend` |
| **Manual DB Backup** | `/opt/taxiterminalen/prod/backups/backup.sh` |
| **Emergency Rollback** | Revert Simply.com A records to original Webnode IP address |
