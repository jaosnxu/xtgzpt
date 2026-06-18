import Fastify from "fastify";
import { platformBoundary } from "@xtgzpt/shared";

export function buildServer() {
  const server = Fastify({
    logger: true
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "xtgzpt-api",
    boundary: platformBoundary
  }));

  return server;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3002);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = buildServer();

  server.listen({ host, port }).catch((error) => {
    server.log.error(error);
    process.exit(1);
  });
}

