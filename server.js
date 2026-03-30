const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

function dockerGet(endpoint) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path: endpoint, method: "GET" },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Failed to parse Docker response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function parseStatsStream(body) {
  return new Promise((resolve, reject) => {
    let data = "";
    body.on("data", (chunk) => (data += chunk));
    body.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Failed to parse stats"));
      }
    });
  });
}

function getContainerStats(containerId) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCKET,
        path: `/containers/${containerId}/stats?stream=false`,
        method: "GET",
      },
      (res) => parseStatsStream(res).then(resolve, reject)
    );
    req.on("error", reject);
    req.end();
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return "0B";
  const units = ["B", "kB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1000));
  return (bytes / Math.pow(1000, i)).toFixed(2) + units[i];
}

function formatStats(container, stats) {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || 1;
  const cpuPerc =
    systemDelta > 0 ? ((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2) : "0.00";

  const memUsage = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 1;
  const memPerc = ((memUsage / memLimit) * 100).toFixed(2);

  const netRx = Object.values(stats.networks || {}).reduce((s, n) => s + n.rx_bytes, 0);
  const netTx = Object.values(stats.networks || {}).reduce((s, n) => s + n.tx_bytes, 0);

  const blockRead = (stats.blkio_stats?.io_service_bytes_recursive || [])
    .filter((e) => e.op === "read" || e.op === "Read")
    .reduce((s, e) => s + e.value, 0);
  const blockWrite = (stats.blkio_stats?.io_service_bytes_recursive || [])
    .filter((e) => e.op === "write" || e.op === "Write")
    .reduce((s, e) => s + e.value, 0);

  return {
    Name: container.Names[0].replace(/^\//, ""),
    CPUPerc: cpuPerc + "%",
    MemUsage: formatBytes(memUsage) + " / " + formatBytes(memLimit),
    MemPerc: memPerc + "%",
    NetIO: formatBytes(netRx) + " / " + formatBytes(netTx),
    BlockIO: formatBytes(blockRead) + " / " + formatBytes(blockWrite),
    PIDs: String(stats.pids_stats?.current || 0),
  };
}

async function getDockerStats() {
  const containers = await dockerGet("/containers/json");
  const statsPromises = containers.map(async (c) => {
    const stats = await getContainerStats(c.Id);
    return formatStats(c, stats);
  });
  return Promise.all(statsPromises);
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/stats") {
    try {
      const stats = await getDockerStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stats));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    const indexPath = path.join(__dirname, "index.html");
    const html = fs.readFileSync(indexPath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }
});

server.listen(PORT, () => {
  console.log(`ministat running at http://localhost:${PORT}`);
});
