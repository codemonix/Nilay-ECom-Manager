import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type Source = "body" | "query" | "params";

/** Validates a request part against a Zod schema and replaces it with the parsed (typed, defaulted) value. */
export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req[source]);
    (req as unknown as Record<Source, unknown>)[source] = parsed;
    next();
  };
}
