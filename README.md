# Two-Tier NestJS + MySQL Learning Application

A minimal, beginner-friendly two-tier web application built with **NestJS**, **TypeORM**, and **MySQL**, featuring a vanilla HTML/CSS/JavaScript frontend served directly by NestJS.

This project recreates the architecture and learning concepts of [Shubham Londhe's two-tier Flask + MySQL application](https://github.com/LondheShubham153/two-tier-flask-app/tree/master), adapted for developers familiar with **TypeScript & Node.js**.

---

## 1. Architecture Overview

### Traditional (Non-Docker / Local Machine)
```text
Browser (http://localhost:3000)
    │
    ▼ (HTTP Request)
NestJS App (listening on 0.0.0.0:3000)
    │
    ▼ (TCP / MySQL Protocol via localhost:3306)
Local MySQL Server
```

### Docker Containerized Architecture (What you will build)
```text
Browser (http://localhost:3000 on Host)
    │
    ▼ (Port Mapping -p 3000:3000)
┌─────────────────────────────────────────────────────────────┐
│ Docker Network (e.g. app-network)                          │
│                                                             │
│   ┌──────────────────────────┐                              │
│   │     NestJS Container     │                              │
│   │   (listening on 0.0.0.0) │                              │
│   └────────────┬─────────────┘                              │
│                │                                            │
│                │ DB_HOST=mysql                              │
│                │ (Docker Embedded DNS resolves "mysql")     │
│                ▼                                            │
│   ┌──────────────────────────┐                              │
│   │     MySQL Container      │                              │
│   │     (service: mysql)     │                              │
│   │     (port: 3306)         │                              │
│   └──────────────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. The Core Docker Networking Concept

### Why `DB_HOST=mysql` works inside Docker
When two containers are attached to the same user-defined Docker bridge network (or started together with Docker Compose), Docker automatically runs an **embedded DNS server** (at `127.0.0.11` inside each container).

- If the MySQL container or Docker Compose service is named `mysql`, Docker's DNS maps the hostname `mysql` to that container's internal IP address (e.g., `172.20.0.2`).
- When NestJS makes a connection to `mysql:3306`, Docker DNS resolves `mysql` seamlessly.

### Why `DB_HOST=localhost` fails inside a Docker container
Each Docker container has its own isolated network namespace and its own network loopback interface (`127.0.0.1` / `localhost`).
- Inside the NestJS container, `localhost` means **this NestJS container**, NOT your host machine, and NOT the MySQL container.
- Because MySQL is running in a completely separate container, the NestJS container trying to connect to `localhost:3306` will result in `ECONNREFUSED`.

### The Core Difference
| Scenario | `DB_HOST` Setting | Reason |
|---|---|---|
| **Local Development** (No Docker) | `DB_HOST=localhost` | MySQL runs directly on your local operating system. |
| **Docker Development** (Containers on same network) | `DB_HOST=mysql` | MySQL runs in a container named `mysql`; Docker DNS resolves this name. |

---

## 3. Local Development (Without Docker)

### Prerequisites
- Node.js (v18+)
- MySQL Server running locally on port 3306

### Steps
1. **Create the database in MySQL**:
   ```sql
   CREATE DATABASE message_db;
   ```

2. **Configure Environment Variables**:
   Copy the provided `example.env` to `.env` (or export environment variables directly in your terminal):
   ```bash
   cp example.env .env
   ```

   Values in `example.env`:
   ```properties
   DB_HOST=localhost
   DB_PORT=3306
   DB_USERNAME=root
   DB_PASSWORD=password
   DB_DATABASE=message_db
   PORT=3000
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run the Application**:
   ```bash
   npm run start:dev
   ```

5. **Visit the App**:
   Open your browser at [http://localhost:3000](http://localhost:3000).

---

## 4. API Reference

| Method | Endpoint | Description | Sample Request / Response |
|---|---|---|---|
| `POST` | `/messages` | Create and save a new message | Body: `{"message": "Hello Docker"}`<br>Returns created object with `id` and `createdAt`. |
| `GET` | `/messages` | List all messages (newest first) | Returns: `[{"id": 1, "message": "...", "createdAt": "..."}]` |
| `GET` | `/messages/:id` | Fetch single message by integer ID | Returns message object or `404 Not Found`. |

---

## 5. Your Docker Exercise

> [!IMPORTANT]
> No `Dockerfile` or `docker-compose.yml` is provided in this repository. 
> The goal of this project is for **you** to write them and master Docker containerization and networking hands-on!

Follow these exercises to complete your learning:

### Exercise 1: Containerizing with Standalone Docker CLI
1. **Write a `Dockerfile` for NestJS**:
   - Use an official Node base image (e.g. `node:20-alpine`).
   - Set working directory to `/app`.
   - Copy `package*.json`, run `npm install`.
   - Copy source code and static assets (`public/`).
   - Run `npm run build`.
   - Expose port `3000`.
   - Set command to `npm run start:prod` (or `node dist/src/main`).
2. **Build the NestJS image**:
   ```bash
   docker build -t my-nestjs-app .
   ```
3. **Create a custom Docker network**:
   ```bash
   docker network create two-tier-net
   ```
4. **Start the MySQL container on the network**:
   ```bash
   docker run -d \
     --name mysql \
     --network two-tier-net \
     -e MYSQL_ROOT_PASSWORD=password \
     -e MYSQL_DATABASE=message_db \
     mysql:8.0
   ```
5. **Start the NestJS container on the same network**:
   ```bash
   docker run -d \
     --name nestjs-app \
     --network two-tier-net \
     -p 3000:3000 \
     -e DB_HOST=mysql \
     -e DB_PORT=3306 \
     -e DB_USERNAME=root \
     -e DB_PASSWORD=password \
     -e DB_DATABASE=message_db \
     my-nestjs-app
   ```
6. **Inspect the network**:
   ```bash
   docker network inspect two-tier-net
   ```
   *Look at the "Containers" section to verify both containers share the subnet and IP range.*
7. **Test from Browser**:
   Visit `http://localhost:3000`, post messages, and verify persistence.

---

### Exercise 2: Defining Everything in `docker-compose.yml`
1. Create a `docker-compose.yml` file.
2. Define two services: `nestjs` and `mysql`.
3. Configure environment variables, port mapping (`3000:3000`), and a shared network.
4. Add a named volume for `/var/lib/mysql` to preserve database records across container restarts.
5. Launch the entire stack using:
   ```bash
   docker compose up --build
   ```
