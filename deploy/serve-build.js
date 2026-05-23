const fs = require("fs");
const http = require("http");
const path = require("path");
const { lookupVessel } = require("./vessel-lookup");

const root = path.join(__dirname, "..", "build");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

  if (url.pathname === "/api/vessel-lookup") {
    lookupVessel(url.searchParams.get("q"))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, 500, { found: false, error: error.message }));
    return;
  }

  const requestedPath = url.pathname === "/"
    ? "index.html"
    : path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(root, requestedPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }

  fs.stat(filePath, (statError, stat) => {
    const finalPath = statError || stat.isDirectory() ? path.join(root, "index.html") : filePath;
    fs.readFile(finalPath, (readError, data) => {
      if (readError) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": contentTypes[path.extname(finalPath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  });
});

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}`);
});
