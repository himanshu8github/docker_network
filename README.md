# 🚀 CloudOps Hub: Production Cloud Observability & Deployment Console

A full-stack, enterprise-grade cloud observability and infrastructure platform built to master and showcase **Docker containerization, Docker bridge networks, Nginx reverse proxying, Cloudflare edge security (WAF & Bot Fight Mode), and AWS EC2 deployment with Elastic IP**.

---

## 1. System Architecture & Topology

```text
Visitor / LinkedIn Demo (https://yourdomain.tech or https://api.yourdomain.tech)
                              │ (HTTPS / TLS 1.3)
                              ▼
        ┌───────────────────────────────────────────────────────────┐
        │                 CLOUDFLARE EDGE NETWORK                   │
        │                                                           │
        │  • Free SSL/TLS Termination (Edge Certificate)            │
        │  • Web Application Firewall (WAF Custom Rules)            │
        │  • Bot Fight Mode & DDoS Anycast Shield                   │
        │  • Subdomain Routing (Root UI @ vs api. Subdomain)        │
        └─────────────────────────────┬─────────────────────────────┘
                                      │ (Proxied Traffic 🟠)
                                      ▼
                        ┌───────────────────────────┐
                        │   AWS EC2 (Elastic IP)    │
                        │   Port 80 Ingress         │
                        └─────────────┬─────────────┘
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────────┐
│ Docker User-Defined Bridge Network: app-net                                   │
│                                                                               │
│   ┌───────────────────────────────────────────────────────────────────────┐   │
│   │                         nginx-proxy Container                         │   │
│   │                         (Listening on Port 80)                        │   │
│   └───────────────┬───────────────────────────────────────┬───────────────┘   │
│                   │ proxy_pass (Root /)                   │ proxy_pass (/api, │
│                   │                                       │  /messages)       │
│                   ▼                                       ▼                   │
│   ┌───────────────────────────────┐       ┌───────────────────────────────┐   │
│   │       ui-app Container        │       │     nestjs-app Container      │   │
│   │     Next.js 14 + TypeScript   │       │   NestJS + TypeORM (TS)       │   │
│   │     (Internal Port 3001)      │       │   (Internal Port 3000)        │   │
│   └───────────────────────────────┘       └───────────────┬───────────────┘   │
│                                                           │                   │
│                                                           │ DB_HOST=mysql     │
│                                                           │ (127.0.0.11 DNS)  │
│                                                           ▼                   │
│                                           ┌───────────────────────────────┐   │
│                                           │        mysql Container        │   │
│                                           │   (Port 3306 - 100% Isolated) │   │
│                                           └───────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure (Monorepo Layout)

The project is decoupled into two clean service directories with independent `.gitignore` configurations and root orchestration:

```text
docker_network/
├── .gitignore                   # Root gitignore (orchestration, global envs, docs)
├── docker-compose.yml           # Multi-container service definitions (mysql, nestjs-app, ui-app, nginx)
├── nginx.conf                   # Reverse proxy config with dual upstreams & proxy_set_header
├── cloudflare.md                # Cloudflare DNS, student domain & security setup guide
├── configure.md                 # Architecture roadmap and milestones
│
├── api/                         # 🟢 BACKEND (NestJS + TypeScript)
│   ├── .gitignore               # API-specific gitignore (dist, node_modules, .env)
│   ├── Dockerfile               # Node 20 Alpine production backend container
│   ├── example.env              # Environment variable template
│   ├── package.json             # NestJS & TypeORM dependencies
│   ├── tsconfig.json            # Backend TypeScript configuration
│   └── src/
│       ├── main.ts              # 0.0.0.0 bind + global CORS configuration
│       ├── app.module.ts        # Root orchestrator module & HTTP request logger
│       ├── database/            # Encapsulated TypeORM MySQL module
│       └── messages/            # Production incident & telemetry service
│
└── ui/                          # 🔵 FRONTEND (Next.js + TypeScript)
    ├── .gitignore               # UI-specific gitignore (.next, out, node_modules)
    ├── Dockerfile               # Multi-stage production container build
    ├── example.env              # UI API URL template
    ├── package.json             # Next.js 14, React 18, TypeScript
    ├── tsconfig.json            # Frontend TypeScript configuration
    ├── next.config.js           # Next.js output and environment config
    └── src/
        ├── app/
        │   ├── globals.css      # Observability theme (Green, Blue, Red, Orange, Yellow, White)
        │   ├── layout.tsx       # Root layout & Google typography
        │   └── page.tsx         # Main dashboard client controller
        └── components/
            ├── Sidebar.tsx      # Responsive sidebar navigation & infrastructure pills
            ├── CustomToast.tsx  # In-app notification toast (Zero browser alerts!)
            ├── EntryModal.tsx   # Custom modal for recording deployments & notes
            ├── TabDeployments.tsx # Tab 1: Deployments & Incident Stream
            ├── TabInsights.tsx  # Tab 2: Architecture Notes (DevPulse)
            └── TabTelemetry.tsx # Tab 3: Edge Telemetry & Grafana Latency Bars
```

---

## 3. Platform Capabilities & 3-Tab Console

### 🚀 Tab 1: Production Deployments & Incidents
* **30-Day SLA Ribbon**: Grafana-style interactive uptime segment bar (99.98% SLA).
* **Live Infrastructure Cards**: Active status for AWS EC2 Elastic IP, Nginx Reverse Proxy, Cloudflare WAF, and MySQL Network Isolation.
* **Audit Stream**: Log and filter production deployments and incident post-mortems with status badges (`deployed`, `operational`, `investigating`, `degraded`, `resolved`).

### 💡 Tab 2: DevOps Architecture Notes & TIL (DevPulse)
* **Engineering Snippets**: Log architectural decisions, container networking concepts, and security takeaways.
* **Category Tags**: Tagged by `#Docker`, `#AWS`, `#Networking`, `#Security`, `#Cloudflare`, and `#Nginx`.

### 📊 Tab 3: Edge Telemetry & Request Inspector
* **Live Ingress Header Table**: Inspect real headers forwarded through Cloudflare (`CF-Ray`, edge colocation point) and Nginx (`X-Real-IP`, `X-Forwarded-For`, `Host`).
* **Active Health Probe**: Trigger live roundtrip health checks measuring client-to-edge latency in milliseconds.
* **Grafana Progress Bars**: Visual breakdown of SSL termination, Nginx upstream pass, Docker DNS resolution, and MySQL query latency.

### 🎨 Design & Experience
* **Observability Palette**: Green (`#10b981`), Blue (`#3b82f6`), Red (`#ef4444`), Orange (`#f97316`), Yellow (`#eab308`), White (`#f8fafc`).
* **Zero Browser `alert()`**: All actions use custom animated in-app toasts and modals.
* **Full Mobile & Desktop Responsiveness**: Collapsible off-canvas sidebar drawer for mobile devices and data-dense multi-column layout for desktop.

---

## 4. Deploying to AWS EC2 with Elastic IP & Cloudflare

### Step 1: Allocate AWS Elastic IP
1. In AWS Console ➔ **EC2** ➔ **Network & Security** ➔ **Elastic IPs**.
2. Click **Allocate Elastic IP address** ➔ **Allocate**.
3. Select the IP ➔ **Actions** ➔ **Associate Elastic IP address** ➔ Select your running EC2 instance.
> *An Elastic IP is permanent across instance reboots, preventing your Cloudflare DNS records from breaking.*

### Step 2: Open Security Group Ports
In your EC2 instance's Security Group, ensure inbound rules allow:
* `Port 22` (SSH) ➔ Your IP
* `Port 80` (HTTP) ➔ `0.0.0.0/0` (Web ingress / Cloudflare)
* `Port 443` (HTTPS) ➔ `0.0.0.0/0` (Encrypted web ingress)
*(Keep ports 3000, 3001, and 3306 closed to public internet).*

### Step 3: Run on EC2 Server
```bash
# SSH into EC2
ssh -i devops-key.pem ubuntu@<YOUR_ELASTIC_IP>

# Clone repository
git clone <YOUR_GITHUB_REPO_URL>
cd docker_network

# Set up production environment
cp api/example.env api/.env
nano api/.env

# Build and start all 4 services via Docker Compose
docker compose up -d --build
```

### Step 4: Configure Cloudflare DNS
In Cloudflare Dashboard ➔ Your `.tech` domain ➔ **DNS**:

| Type | Name | Content | Proxy Status |
| :--- | :--- | :--- | :--- |
| **A** | `@` (Root) | `<YOUR_ELASTIC_IP>` | 🟠 **Proxied** |
| **A** | `api` | `<YOUR_ELASTIC_IP>` | 🟠 **Proxied** |
| **CNAME** | `www` | `yourdomain.tech` | 🟠 **Proxied** |

Under **SSL/TLS** ➔ set mode to **Full** and enable **Always Use HTTPS** and **Bot Fight Mode** under **Security ➔ Bots**.

---

## 5. Ready-to-Use LinkedIn Portfolio Post

```text
🚀 Excited to share my latest Cloud & DevOps project: CloudOps Hub!

While working as a Full-Stack Engineer, I wanted to dive deeper into production container networking, reverse proxies, and edge security. Instead of building another basic todo app, I designed and deployed an enterprise-grade Cloud Observability & Deployment Console on AWS.

🏗️ Architecture Highlights:
• Decoupled Monorepo: Next.js 14 (TypeScript) frontend + NestJS (TypeScript + TypeORM) backend + MySQL database.
• Edge Security: Cloudflare Anycast network handling free SSL termination, Bot Fight Mode, and custom WAF rate-limiting rules.
• Ingress Routing: Nginx reverse proxy running on standard port 80 on an AWS EC2 Elastic IP, forwarding traffic to internal containers via Docker bridge networking (app-net).
• Database Isolation: MySQL port 3306 is completely unpublished to the host and resolves strictly over Docker's internal DNS (127.0.0.11).
• Live Telemetry: Built an edge request inspector to verify forwarded client headers (CF-Ray, X-Real-IP, X-Forwarded-For) and internal database connection pool latencies in real time.

Live Demo: https://yourdomain.tech
GitHub: https://github.com/<your-username>/docker_network

#DevOps #Docker #AWS #Nginx #Cloudflare #NextJS #NestJS #CloudComputing #SoftwareEngineering
```
