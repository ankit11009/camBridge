# CamBridge

CamBridge is a plugin-based IP camera integration and monitoring platform architecturally inspired by Scrypted. It provides a unified, extensible abstraction layer over heterogeneous IP camera protocols (Mock, RTSP, ONVIF) alongside real-time status and telemetry over WebSockets, low-latency live streaming via FFmpeg and HLS, and camera lifecycle management.

## Setup & Quickstart

### Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose
- Node.js 20+ (for local development outside containers)

### Running with Docker Compose
1. Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
2. Start the full stack (PostgreSQL, Redis, NestJS backend, Vite frontend):
   ```bash
   docker compose up --build
   ```
3. Access the services:
   - Frontend Dashboard: [http://localhost:5173](http://localhost:5173)
   - Backend API & Health Check: [http://localhost:3000/health](http://localhost:3000/health)
