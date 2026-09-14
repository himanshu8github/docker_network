# 🐳 Three-Tier Containerized Architecture: NestJS + MySQL + Nginx

A complete hands-on learning project exploring **Docker containerization, custom bridge networks, container-to-container DNS resolution, database network isolation, and Nginx reverse proxying**.

Inspired by [Shubham Londhe's two-tier Flask + MySQL project](https://github.com/LondheShubham153/two-tier-flask-app/tree/master), adapted and scaled using **NestJS (TypeScript) + TypeORM + MySQL + Nginx + Vanilla HTML/CSS/JS**.

---

## 1. System Architecture

### Production 3-Tier Setup (With Nginx Reverse Proxy)
```text
Browser / Client (http://<EC2_PUBLIC_IP>)  <-- Standard Port 80 (No custom port needed)
        │
        ▼ (Public Traffic)
┌───────────────────────────────────────────────────────────────────────────┐
│ Docker Custom Bridge Network: two-tier-net                                │
│                                                                           │
│   ┌────────────────────────────────┐                                      │
│   │    nginx-proxy Container       │                                      │
│   │    (Listening on Port 80)      │                                      │
│   └───────────────┬────────────────┘                                      │
│                   │                                                       │
│                   │ proxy_pass http://nestjs-app:3000                     │
│                   ▼                                                       │
│   ┌────────────────────────────────┐                                      │
│   │    nestjs-app Container        │                                      │
│   │    (Listening on Port 3000)    │ (Port 3000 is hidden from internet!) │
│   └───────────────┬────────────────┘                                      │
│                   │                                                       │
│                   │ DB_HOST=mysql (Docker Embedded DNS: 127.0.0.11)       │
│                   ▼                                                       │
│   ┌────────────────────────────────┐                                      │
│   │    mysql Container             │                                      │
│   │    (Listening on Port 3306)    │ (Port 3306 is 100% isolated!)        │
│   └────────────────────────────────┘                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core DevOps & Docker Concepts Learned

### 🔹 1. Docker Bridge Networks & Internal DNS
* **The Problem:** Inside a container, `localhost` points to the container itself. Connecting to `DB_HOST=localhost` fails with `ECONNREFUSED`.
* **The Solution:** By placing containers on a custom user-defined network (`docker network create two-tier-net`), Docker's embedded DNS server (`127.0.0.11`) automatically translates the hostname **`mysql`** to the MySQL container's private IP.

### 🔹 2. Database Network Isolation (Security First)
* We deliberately **do NOT publish port 3306** to the host (no `-p 3306:3306`).
* **Result:** 
  * Outside Internet ➔ MySQL: ❌ Blocked
  * EC2 Host ➔ MySQL: ❌ Blocked
  * NestJS Container ➔ MySQL: ✅ Allowed (purely private, container-to-container communication).

### 🔹 3. Nginx as a Reverse Proxy
* Placed Nginx at the front door on standard web port **80**.
* Users access the site directly via `http://<IP>` without needing custom backend ports (`:3000` or `:3002`).
* Nginx handles request buffering and passes real client headers (`X-Real-IP`, `X-Forwarded-For`) to NestJS.

### 🔹 4. Failure Mode Analysis (502 Bad Gateway vs 504 Gateway Timeout)
* **502 Bad Gateway:** Occurs when Nginx is alive, but the upstream backend (`nestjs-app`) is stopped or connection is immediately refused (`Connection Refused`).
* **504 Gateway Timeout:** Occurs when Nginx successfully connects to the backend, but the backend takes longer than the timeout limit (e.g. 60s) to reply.
* **Security Hardening:** Added `server_tokens off;` in `nginx.conf` so the 502 page only says `nginx` without revealing the version number (`1.31.5`).

### 🔹 5. Active Container Health Checks
* Rather than assuming a container is ready as soon as it launches, we use Docker's `healthcheck` instruction (`mysqladmin ping`).
* **Why it matters:** MySQL takes several seconds to initialize database files on startup. Without a healthcheck, dependent services (`nestjs-app`) will fail to connect on boot.
* Using `depends_on: { mysql: { condition: service_healthy } }` ensures the application tier waits until MySQL is fully operational.

### 🔹 6. Auto-Restart Behavior: Intentional Stop vs. Process Crash
* **`restart: unless-stopped`** policy restarts containers across crashes and server reboots, **except** when intentionally stopped via `docker stop`.
* `docker stop` sends `SIGTERM` (graceful shutdown) ➔ Docker respects this as manual maintenance, so `RestartCount` remains `0`.
* A real crash (simulated via `docker exec <container> kill -9 1` or an unhandled Node error) triggers Docker's auto-healing daemon, reviving the container and incrementing `RestartCount`.

### 🔹 7. Privacy & Log Anonymization
* Access logs in production environments often fall under privacy regulations (GDPR).
* We practiced both **Nginx-level IP anonymization** (via `map` directives in `nginx.conf`) and **CLI-level real-time log stream masking** (using `sed` in Bash or regex in PowerShell) to mask client IPs as `xxx.xxx.xxx.xxx` or `[HIDDEN_IP]`.


---

## 3. Clean Enterprise NestJS Architecture

The backend code adheres to clean, production-grade modular standards:

```text
src/
├── main.ts                     # Bootstrap & 0.0.0.0 binding
├── app.module.ts               # Root orchestrator module
├── config/                     # Centralized environment configuration
│   ├── config.schema.ts        # Joi validation schema (fail-fast on missing keys)
│   ├── config.service.ts       # Typed getters (port, dbHost, dbPassword, etc.)
│   ├── config.controller.ts    # GET /config/info (safe runtime config inspection)
│   └── config.module.ts        # Global module exporting AppConfigService
├── database/
│   └── sqldb.module.ts         # Encapsulated TypeOrmModule.forRootAsync
├── messages/                   # Feature module
│   ├── message.entity.ts       # MySQL Message entity
│   ├── messages.controller.ts   # POST /messages, GET /messages, GET /messages/:id
│   ├── messages.service.ts      # TypeORM repository interaction
│   └── dto/create-message.dto.ts
public/                         # Static Frontend served by NestJS
├── index.html                  # Message Board UI
├── style.css                   # Clean, responsive styling
└── app.js                      # Vanilla JavaScript DOM & fetch logic
```

---

## 4. Hands-On Step-by-Step Deployment Cheatsheet

### Step 1: Create the Private Docker Network
```bash
docker network create two-tier-net
```

### Step 2: Run the MySQL Container (Isolated)
```bash
docker run -d \
  --name mysql \
  --network two-tier-net \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=message_db \
  mysql:latest
```

### Step 3: Build & Run the NestJS Backend
```bash
# Build the Docker image
docker build -t nestjs_backend_app .

# Run the container (Notice: No -p flag needed! Hidden behind Nginx)
docker run -d \
  --name nestjs-app \
  --network two-tier-net \
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=password \
  -e DB_DATABASE=message_db \
  nestjs_backend_app
```

### Step 4: Run the Nginx Reverse Proxy
```bash
docker run -d \
  --name nginx-proxy \
  --network two-tier-net \
  -p 80:80 \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:alpine
```

### Step 5: Test in Browser
Open your browser and visit:
```text
http://<YOUR_EC2_PUBLIC_IP>
```
*(No port number required!)*

---

## 5. Useful Verification & Troubleshooting Commands

### 📋 General Container & Network Operations
| Task | Command |
|---|---|
| **View running containers** | `docker ps` |
| **View containers and networks** | `docker ps --format "table {{.Names}}\t{{.Networks}}\t{{.Status}}"` |
| **Inspect private network** | `docker network inspect two-tier-net` |
| **Reload Nginx config (zero downtime)** | `docker exec -it nginx-proxy nginx -s reload` |
| **Log in to MySQL container shell** | `docker exec -it mysql mysql -u root -p` |
| **Check public IP from EC2** | `curl checkip.amazonaws.com` |

---

### 🔍 Health Check & Auto-Restart Diagnostics
| Task | Command |
|---|---|
| **Inspect MySQL Health Check logs** | `docker inspect --format='{{json .State.Health}}' mysql` |
| **Quick check health status** | `docker inspect --format='{{.State.Health.Status}}' mysql` |
| **Simulate Manual Stop (RestartCount stays 0)** | `docker stop nestjs-app` |
| **Simulate Process Crash (Triggers Auto-Restart)** | `docker exec nestjs-app kill -9 1` |
| **Inspect Container Status & RestartCount** | `docker inspect --format='Status: {{.State.Status}} \| RestartCount: {{.RestartCount}} \| StartedAt: {{.State.StartedAt}}' nestjs-app` |
| **Stream Live Container Lifecycle Events** | `docker events --filter container=nestjs-app` |

---

### 🛡️ Nginx Log Streaming & Privacy Masking (Hide Client IP)
| Task | Command |
|---|---|
| **Stream Nginx logs (standard)** | `docker logs -f nginx-proxy` |
| **Stream with timestamps** | `docker logs -t -f nginx-proxy` |
| **View only recent 50 lines** | `docker logs --tail 50 nginx-proxy` |
| **Mask ALL IPv4 addresses (Linux / Bash)** | `docker logs -f nginx-proxy 2>&1 \| sed -E 's/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/xxx.xxx.xxx.xxx/g'` |
| **Mask ALL IPv4 addresses (PowerShell)** | `docker logs -f nginx-proxy 2>&1 \| ForEach-Object { $_ -replace '\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', 'xxx.xxx.xxx.xxx' }` |
| **Filter error logs only** | `docker logs nginx-proxy 2>&1 \| grep -E "error\|warn"` |

---

## 6. Local Development (Without Docker)

1. Copy environment template:
   ```bash
   copy example.env .env
   ```
2. Start local MySQL and create database:
   ```sql
   CREATE DATABASE message_db;
   ```
3. Install dependencies and run:
   ```bash
   npm install
   npm run start:dev
   ```
4. Access at: `http://localhost:3000` (or the port defined in `.env`).

---

## 7. Learning Roadmap & Milestones
- [x] Two-Tier NestJS + MySQL Architecture
- [x] Docker Custom Bridge Network & Embedded DNS
- [x] Database Network Isolation (Zero Published Ports)
- [x] Nginx Reverse Proxy (Port 80 front door)
- [x] Failure Simulation (502 Bad Gateway) & Security Hardening (`server_tokens off;`)
- [x] Enterprise Config & Database Modules (Joi + `SqlDbModule`)
- [x] Container Health Checks (`mysqladmin ping` + `condition: service_healthy`)
- [x] Crash Recovery & Auto-Restart Policies (`unless-stopped` vs `docker stop` vs PID 1 kill)
- [x] Real-time Log Stream Analysis & IP Privacy Masking (`sed` & regex filtering)
- [ ] Multiple Backend Replicas & Load Balancing (Round-Robin via Nginx upstream)
- [ ] Restricted Database User (CRUD only, block DROP/TRUNCATE)
- [ ] AWS Secrets Manager Integration

