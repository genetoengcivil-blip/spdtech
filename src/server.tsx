import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import { renderToResponse } from "@tanstack/start/server";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const vite = await createViteServer({
        server: { host: "0.0.0.0", port: 54321 },
        appType: "custom",
      });

      const response = await vite.ssrLoadModule("./src/server.tsx");
      const html = await renderToResponse(response, request, {
        url: request.url,
        protocol: "http",
        host: "localhost",
        port: 54321,
      });

      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    } catch (e: any) {
      return new Response(e.message || e.toString(), {
        status: 500,
        headers: { "content-type": "text/plain" },
      });
    }
  },
};