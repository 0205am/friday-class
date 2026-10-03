import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGoogleHandler } from "./server/google.mjs";
const googleHandler = createGoogleHandler();
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  process.argv[2] ?? ".",
);
const port = Number(process.env.PORT ?? 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname.startsWith("/api/google/"))
        return await googleHandler(req, res);
      if (
        pathname !== "/" &&
        !/^\/(index\.html|styles\.css|app\.js|modules\/[\w-]+\.js)$/.test(
          pathname,
        )
      ) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const target = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!target.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const content = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          mime[path.extname(target)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Dashboard ready: http://localhost:${port}`),
  );
