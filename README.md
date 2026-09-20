# 🚀 CloudOps Hub: Production Cloud Observability & Tech Blog Platform

A production-grade, full-stack cloud application and observability platform built to master and showcase **Docker container networking, Nginx reverse proxying, Cloudflare edge security (WAF, Bot Fight Mode, and Geo-headers), AWS EC2 deployment with Elastic IP, and full-stack telemetry tracking**.

The platform is decoupled into a **Public Tech Blog** (User application) and an isolated **Observability & Telemetry Console** (Admin dashboard).

---

## 1. System Architecture & Topology

```text
Visitor (https://yourdomain.tech)           Admin (https://dashboard.yourdomain.tech)
                     │                                         │
                     │                 (HTTPS / TLS 1.3)       │
                     └────────────────────┬────────────────────┘
                                          ▼
             ┌───────────────────────────────────────────────────────────┐
             │                 CLOUDFLARE EDGE NETWORK                   │
             │                                                           │
             │  • SSL/TLS Termination (Edge Certificate)                 │
             │  • WAF Custom Rules & DDoS Anycast Protection             │
             │  • Bot Fight Mode & Real Client IP Restoration            │
             │  • Ingress Headers: CF-Ray, CF-Connecting-IP, CF-Country │
             └────────────────────────────┬──────────────────────────────┘
                                          │ (Proxied Traffic 🟠)
                                          ▼
                            ┌───────────────────────────┐
                            │   AWS EC2 (Elastic IP)    │
                            │   Port 80 / 443 Ingress   │
                            └─────────────┬─────────────┘
                                          │
    ┌─────────────────────────────────────▼─────────────────────────────────────┐
    │ Docker User-Defined Bridge Network: app-net                               │
    │                                                                           │
    │   ┌───────────────────────────────────────────────────────────────────┐   │
    │   │                       nginx-proxy Container                       │   │
    │   │                    (Listening on Port 80 / 443)                   │   │
    │   └───────────────┬───────────────────┬───────────────────┬───────────┘   │
    │                   │                   │                   │               │
    │   proxy_pass /    │      proxy_pass / │      proxy_pass / │               │
    │   (root domain)   │      (dashboard.) │      (api. / /api)│               │
    │                   ▼                   ▼                   ▼               │
    │   ┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────┐   │
    │   │    ui-user Service    │ │  ui-admin Service │ │    nestjs-app     │   │
    │   │   React + Vite (TS)   │ │ React + Vite (TS) │ │ NestJS + TypeORM  │   │
    │   │     (Port 3001)       │ │    (Port 3002)    │ │   (Port 3000)     │   │
    │   └───────────────────────┘ └───────────────────┘ └─────────┬─────────┘   │
    │                                                             │             │
    │                                             DB_HOST=mysql   │             │
    │                                             (127.0.0.11 DNS)│             │
    │                                                             ▼             │
    │                                               ┌───────────────────────┐   │
    │                                               │    mysql Container    │   │
    │                                               │ (Port 3306 Isolated)  │   │
    │                                               └───────────────────────┘   │
    └───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Port & Service Matrix

| Service | Local Port | URL | Command | Description |
| :--- | :---: | :--- | :--- | :--- |
| **Backend API** | `3000` | `http://localhost:3000` | `cd api && npm run start:dev` | NestJS REST API, crypto auth, Bloom filter, MySQL TypeORM |
| **User Application** | `3001` | `http://localhost:3001` | `cd ui && npm run dev` | Public tech blog portal (clean cream aesthetic, no admin controls) |
| **Admin Console** | `3002` | `http://localhost:3002/admin.html` | `cd ui && npm run dev:admin` | Dark Web3 observability dashboard, live telemetry, visit analytics |
| **MySQL Database** | `3306` | `localhost:3306` | Native / Docker | Isolated database service (auto-synchronized schema) |

---

## 3. Key Modules & Technical Capabilities

### 📝 Public Tech Blog Portal (Port 3001)
* **Cream Minimalist Aesthetic**: Curated light-theme engineering UI matching modern technical blogs.
* **Community Feed & Real Data**: Paginated, searchable technical articles stored in MySQL (`blogs` table).
* **Category Tagging**: Filter by `#Docker`, `#AWS`, `#DevOps`, `#Security`, `#Networking`, `#Architecture`.
* **Strict Plain-Text Content Validation**:
  * Articles require 100–1,500 characters of high-quality technical content.
  * Strict anti-abuse filter: Emojis (`\p{Extended_Pictographic}`) and image tags (`<img`, `![]()`, `data:image`) are prohibited to maintain clean engineering copy.
* **User Authentication**:
  * Native Node.js `crypto` HMAC-SHA256 signed access tokens (2-hour expiry) and persistent refresh tokens (2-day expiry).
  * Real-time **Bloom Filter** username lookup to immediately detect collisions before database querying.

### 🛡️ Admin Observability & Telemetry Console (Port 3002)
* **Complete Port & UI Decoupling**: Admin console runs on a dedicated port and is completely inaccessible from the user microsite header.
* **Live Ingress Stream**:
  * Circular in-memory buffer streaming all live incoming requests with HTTP method, path, response status, duration (ms), client IP, and user-agent.
* **Cloudflare Header Inspector**:
  * Captures real edge headers: `CF-Ray`, `CF-Connecting-IP`, `CF-IPCountry`, `X-Forwarded-For`.
* **Database & Engine Telemetry**:
  * Real-time MySQL latency tracking, query counts, active connection pool stats, and server memory consumption.
* **User & Visit Directory**:
  * Full audit log of registered authors, roles, and geographical visit logs (`page_visits` table).
* **Default Admin Credentials** (auto-seeded on startup):
  * **Email**: `admin@cloudops.tech`
  * **Password**: `Admin123456`

---

## 4. Project Structure

```text
docker_network/
├── .gitignore                   # Root gitignore (blocking all .env and *example.env*)
├── docker-compose.yml           # Multi-container orchestration (mysql, nestjs-app, ui-app, nginx)
├── nginx.conf                   # Reverse proxy config with dual upstreams & headers
├── cloudflare.md                # Cloudflare DNS, SSL & WAF setup guide
├── configure.md                 # Architecture roadmap & milestones
├── README.md                    # Project documentation
│
├── api/                         # 🟢 BACKEND (NestJS + TypeScript)
│   ├── .gitignore               # API-specific gitignore
│   ├── Dockerfile               # Production container definition
│   ├── example.env              # Environment template
│   ├── package.json             # NestJS, TypeORM, MySQL2, Class-Validator
│   ├── tsconfig.json            # TypeScript config with moduleResolution: node
│   └── src/
│       ├── main.ts              # Global CORS, ValidationPipe, 0.0.0.0 bind
│       ├── app.module.ts        # Root orchestrator module & middleware wiring
│       ├── admin/               # Admin authentication, seeding, and role guards
│       ├── analytics/           # Cloudflare visitor analytics & page-visit tracking
│       ├── auth/                # CryptoService (HMAC-SHA256), BloomFilterService, Guards
│       ├── blogs/               # CRUD for community articles with plain-text validator
│       ├── common/              # RequestLoggerMiddleware (circular telemetry buffer)
│       ├── config/              # Joi-validated environment service
│       ├── dashboard/           # Ingress metrics, telemetry service, system health
│       ├── database/            # TypeOrmModule with synchronize: true
│       ├── roles/               # Role entity (admin, user)
│       └── users/               # User entity & credentials
│
└── ui/                          # 🔵 FRONTEND (React + Vite + TypeScript)
    ├── .gitignore               # UI-specific gitignore
    ├── Dockerfile               # Production multi-stage Vite build
    ├── example.env              # UI API URL template
    ├── package.json             # Dual dev scripts (dev on 3001, dev:admin on 3002)
    ├── tsconfig.json            # Frontend TypeScript configuration
    ├── vite.config.ts           # User blog config (Port 3001)
    ├── vite.admin.config.ts     # Admin console config (Port 3002)
    ├── index.html               # Entry point for User Blog
    ├── admin.html               # Entry point for Admin Console
    └── src/
        ├── App.tsx              # Public Blog Portal (Cream minimalist theme)
        ├── AdminApp.tsx         # Standalone Admin Console controller
        ├── admin-main.tsx       # Entry script for admin.html
        ├── main.tsx             # Entry script for index.html
        ├── index.css            # Complete design system (Dual light & dark Web3 theme)
        └── components/
            ├── AdminPortal.tsx  # Telemetry stream, metrics, user list, visit table
            ├── AuthModal.tsx    # Sign In & Register modal with Bloom filter check
            ├── PostBlogModal.tsx# Article publisher with live character & emoji checker
            └── CustomToast.tsx  # Animated non-intrusive notifications
```

---

## 5. Local Development Setup

### Prerequisites
* Node.js v18+ (tested on Node 20 / 22 / 24)
* MySQL Server (local or Docker container on port 3306)

### 1. Database Configuration
Create a database in MySQL:
```sql
CREATE DATABASE message_db;
```

In `api/.env`, configure your database credentials:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_actual_mysql_password
DB_DATABASE=message_db
NODE_ENV=development
```
*(No manual migrations needed — TypeORM auto-synchronizes all tables upon startup).*

### 2. Start Backend API
```bash
cd api
npm install
npm run start:dev
```
*API runs at `http://localhost:3000`.*

### 3. Start Public Blog Portal
```bash
cd ui
npm install
npm run dev
```
*User Blog runs at `http://localhost:3001`.*

### 4. Start Admin Observability Console
```bash
cd ui
npm run dev:admin
```
*Admin Console runs at `http://localhost:3002/admin.html`.*

---

## 6. Deploying to AWS EC2 Behind Cloudflare

### Step 1: Allocate an AWS Elastic IP
1. In the AWS Console ➔ **EC2** ➔ **Elastic IPs** ➔ **Allocate Elastic IP address**.
2. Select the allocated IP ➔ **Actions** ➔ **Associate Elastic IP address** ➔ Choose your running EC2 instance.
> *An Elastic IP is static and prevents IP reassignment on instance stop/start.*

### Step 2: Configure EC2 Security Group
Ensure inbound rules allow:
* `Port 22` (SSH) ➔ Your IP only
* `Port 80` (HTTP) ➔ `0.0.0.0/0` (Ingress from Cloudflare)
* `Port 443` (HTTPS) ➔ `0.0.0.0/0` (Ingress from Cloudflare)
*(Ports 3000, 3001, 3002, and 3306 remain closed to the public internet).*

### Step 3: Run via Docker Compose on EC2
```bash
# SSH into EC2
ssh -i devops-key.pem ubuntu@<YOUR_ELASTIC_IP>

# Clone the repository
git clone https://github.com/himanshu8github/docker_network.git
cd docker_network

# Start services
docker compose up -d --build
```

### Step 4: Configure Cloudflare DNS & SSL
In Cloudflare Dashboard ➔ Your domain ➔ **DNS**:

| Type | Name | Content | Proxy Status |
| :--- | :--- | :--- | :--- |
| **A** | `@` (Root Blog) | `<YOUR_ELASTIC_IP>` | 🟠 **Proxied** |
| **A** | `dashboard` (Admin Console) | `<YOUR_ELASTIC_IP>` | 🟠 **Proxied** |
| **A** | `api` (NestJS Backend) | `<YOUR_ELASTIC_IP>` | 🟠 **Proxied** |
| **CNAME** | `www` | `yourdomain.tech` | 🟠 **Proxied** |

Under **SSL/TLS** ➔ set mode to **Full**. Under **Security ➔ Bots** ➔ enable **Bot Fight Mode**.

---

## 7. Ready-to-Use LinkedIn Portfolio Post

```text
🚀 Excited to share my latest Cloud & DevOps project: CloudOps Hub!

Instead of building another basic mock app, I built and deployed a production-ready, full-stack application coupled with an enterprise-grade Observability Console on AWS.

🏗️ Architecture Highlights:
• Decoupled Architecture: React + Vite + TypeScript frontend, NestJS + TypeORM backend, and isolated MySQL database.
• Strict Port & Subdomain Isolation: Public Tech Blog on port 3001, completely isolated Admin Observability Console on port 3002, and REST API on port 3000.
• Edge Security & Anycast: Cloudflare WAF, Bot Fight Mode, and SSL termination passing real client headers (CF-Ray, CF-Connecting-IP, CF-IPCountry).
• Ingress & Reverse Proxy: Nginx on port 80/443 on an AWS Elastic IP, routing traffic across an internal Docker bridge network (app-net).
• Live Telemetry Stream: Custom circular in-memory buffer and middleware streaming live HTTP request durations, MySQL query latencies, and edge geography.
• Custom Auth & Anti-Abuse: Native Node.js crypto HMAC tokens, real-time Bloom filter username collision checking, and strict plain-text validation.

GitHub: https://github.com/himanshu8github/docker_network

#DevOps #Docker #AWS #Cloudflare #Nginx #NestJS #React #CloudComputing #SoftwareEngineering #Observability
```
