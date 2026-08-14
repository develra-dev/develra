import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const siteRoot = path.resolve(import.meta.dirname, "..", "site");
const requestedPort = Number.parseInt(
  process.env.DEVELRA_SITE_PORT ?? "4173",
  10,
);
const port =
  Number.isSafeInteger(requestedPort) && requestedPort > 0
    ? requestedPort
    : 4173;
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function reply(response, status, body) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    reply(response, 405, "Method not allowed\n");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
  } catch {
    reply(response, 400, "Bad request\n");
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(siteRoot, `.${requestedPath}`);
  const relative = path.relative(siteRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    reply(response, 404, "Not found\n");
    return;
  }

  try {
    const details = await stat(filePath);
    if (!details.isFile()) {
      reply(response, 404, "Not found\n");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": details.size,
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
      "Content-Type":
        contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    reply(response, 404, "Not found\n");
  }
});

server.on("error", (error) => {
  console.error(`Unable to start the website preview: ${error.message}`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Develra website: http://127.0.0.1:${port}`);
  console.log("Press Ctrl+C to stop.");
});

function close() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
