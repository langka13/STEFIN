import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import aiHandler from "./api/ai.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Use the same API route handlers as Vercel
  app.post("/api/ai", aiHandler);

  // We need to dynamically import or just create simple handlers to proxy these in Express mode
  app.post("/api/chat", async (req, res) => {
    const handler = await import("./api/chat.js");
    return handler.default(req, res);
  });
  
  app.post("/api/analysis", async (req, res) => {
    const handler = await import("./api/analysis.js");
    return handler.default(req, res);
  });

  app.post("/api/extract-tx", async (req, res) => {
    const handler = await import("./api/extract-tx.js");
    return handler.default(req, res);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
