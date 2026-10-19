const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.join(__dirname, "frontend");
const CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
};

function sendError(response, statusCode, message) {
    response.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(message);
}

function serveStatic(request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        sendError(response, 405, "Method not allowed.");
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname);
    } catch {
        sendError(response, 400, "Invalid URL path.");
        return;
    }
    if (pathname === "/login") {
        pathname = "/login.html";
    } else if (pathname === "/") {
        pathname = "/index.html";
    }

    const filePath = path.resolve(FRONTEND_DIR, pathname.slice(1));
    if (!filePath.startsWith(`${FRONTEND_DIR}${path.sep}`)) {
        sendError(response, 403, "Access denied.");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendError(response, error.code === "ENOENT" ? 404 : 500,
                error.code === "ENOENT" ? "File not found." : "Unable to read frontend file.");
            return;
        }

        response.writeHead(200, {
            "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
            "Cache-Control": "no-cache"
        });
        response.end(request.method === "HEAD" ? undefined : content);
    });
}

const server = http.createServer(serveStatic);
server.listen(PORT, HOST, () => {
    console.log(`NovaBank is running at http://${HOST}:${PORT}`);
});
