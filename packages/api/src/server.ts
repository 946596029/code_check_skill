import express from "express";
import cors from "cors";
import rulesRouter from "./routes/rules";
import checkRouter from "./routes/check";

export function createServer(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/rules", rulesRouter);
  app.use("/api/check", checkRouter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

export function startServer(port: number = 3000): void {
  const app = createServer();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
