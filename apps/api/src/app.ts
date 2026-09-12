import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { errorHandler } from "./middleware/errorHandler.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { tenantsRouter } from "./modules/tenants/tenants.routes.js";
import { providersRouter } from "./modules/providers/providers.routes.js";
import { scenariosRouter } from "./modules/scenarios/scenarios.routes.js";
import { sessionsRouter } from "./modules/sessions/sessions.routes.js";
import { teamsRouter } from "./modules/teams/teams.routes.js";
import { roundsRouter } from "./modules/rounds/rounds.routes.js";
import { negotiationsRouter } from "./modules/negotiations/negotiations.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/tenants", tenantsRouter);
  app.use("/api/providers", providersRouter);
  app.use("/api/scenarios", scenariosRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api", teamsRouter);
  app.use("/api", roundsRouter);
  app.use("/api", negotiationsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No such route" } });
  });

  app.use(errorHandler);
  return app;
}
