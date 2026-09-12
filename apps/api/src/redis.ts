import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Separate connections for pub/sub-style usage (Socket.IO adapter, BullMQ)
 * vs. general commands, since a connection subscribed to a channel can't
 * issue other commands on the same connection.
 */
export function createRedisClient(name: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
  client.on("error", (err) => logger.error({ err, client: name }, "Redis client error"));
  client.on("connect", () => logger.info({ client: name }, "Redis client connected"));
  return client;
}

export const redis = createRedisClient("default");
