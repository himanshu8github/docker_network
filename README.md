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

| Task | Command |
|---|---|
| **View running containers** | `docker ps` |
| **View containers and networks** | `docker ps --format "table {{.Names}}\t{{.Networks}}\t{{.Status}}"` |
| **Inspect private network** | `docker network inspect two-tier-net` |
| **Stream Nginx proxy logs** | `docker logs -f nginx-proxy` |
| **Stream NestJS app logs** | `docker logs -f nestjs-app` |
| **Stream MySQL database logs** | `docker logs -f mysql` |
| **Reload Nginx config (zero downtime)** | `docker exec -it nginx-proxy nginx -s reload` |
| **Simulate 502 Bad Gateway** | `docker stop nestjs-app` |
| **Recover backend from failure** | `docker start nestjs-app` |
| **Log in to MySQL container shell** | `docker exec -it mysql mysql -u root -p` |
| **Check public IP from EC2** | `curl checkip.amazonaws.com` |

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

## 7. Upcoming Learning Roadmap
- [x] Two-Tier NestJS + MySQL Architecture
- [x] Docker Custom Bridge Network & DNS
- [x] Database Network Isolation
- [x] Nginx Reverse Proxy (Port 80)
- [x] Failure Simulation (502 Bad Gateway) & Security Hardening (`server_tokens off;`)
- [x] Enterprise Config & Database Modules (Joi + `SqlDbModule`)
- [ ] Multiple Backend Replicas & Load Balancing (Round-Robin via Nginx upstream)
- [ ] Restricted Database User (CRUD only, block DROP/TRUNCATE)
- [ ] AWS Secrets Manager Integration
