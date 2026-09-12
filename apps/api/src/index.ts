import { createServer } from "node:http";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { connectDatabase, disconnectDatabase } from "./db.js";
import { createApp } from "./app.js";
import { initSocketServer } from "./realtime/socket.js";
import { registerNegotiationSocketHandlers } from "./modules/negotiations/negotiations.socket.js";
import { startScenarioGenerationWorker } from "./jobs/workers/scenarioGeneration.worker.js";
import { startProposalEvaluationWorker } from "./jobs/workers/proposalEvaluation.worker.js";
import { startRoundTimerWorker } from "./jobs/workers/roundTimer.worker.js";

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const httpServer = createServer(app);

  const io = await initSocketServer(httpServer);
  registerNegotiationSocketHandlers(io);

  const workers = [startScenarioGenerationWorker(), startProposalEvaluationWorker(), startRoundTimerWorker()];

  await new Promise<void>((resolve) => httpServer.listen(env.PORT, resolve));
  logger.info(`KLD Sim API listening on port ${env.PORT} (${env.NODE_ENV})`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);
    httpServer.close();
    io.close();
    await Promise.all(workers.map((worker) => worker.close()));
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during API startup");
  process.exit(1);
});
