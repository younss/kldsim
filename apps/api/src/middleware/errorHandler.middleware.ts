import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { InvalidAllocationError } from "@kldsim/shared";
import { LLMValidationError, AllProvidersFailedError } from "@kldsim/llm-gateway";
import { HttpError } from "../errors.js";
import { logger } from "../logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request failed validation",
        issues: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    });
    return;
  }

  if (err instanceof InvalidAllocationError) {
    res.status(400).json({ error: { code: "INVALID_ALLOCATION", message: err.message } });
    return;
  }

  if (err instanceof LLMValidationError) {
    res.status(502).json({ error: { code: "LLM_VALIDATION_FAILED", message: err.message } });
    return;
  }

  if (err instanceof AllProvidersFailedError) {
    res.status(502).json({ error: { code: "ALL_PROVIDERS_FAILED", message: err.message, attempts: err.attempts } });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};
