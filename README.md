# ministat

Simple Docker stats dashboard. Shows CPU, memory, network I/O, block I/O, and PIDs for all running containers.

## Quick Start

### Docker or OrbStack (recommended)

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

### Without Docker

```bash
npm install
npm start
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the web server listens on |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Path to the Docker daemon socket |

### OrbStack

Works out of the box with OrbStack since it exposes the Docker API on the same socket path.

## Features

- Real-time container stats via the Docker Engine API
- Light / Dark / System theme toggle
- Pause and resume live updates
- Sortable columns (click any header)
- Color-coded CPU and memory usage (green/yellow/red)
- Responsive layout for mobile
- Zero dependencies beyond Node.js
- Compatible with Docker Desktop and OrbStack
