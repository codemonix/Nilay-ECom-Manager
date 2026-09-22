const REDACTED = "[REDACTED]";
const MAX_DEPTH = 8;

/** Keys whose values are always masked, matched case-insensitively against the key with `-`/`_` removed. */
const SENSITIVE_KEY_PATTERN = /(privatekey|apikey|accesskey|secret|token|password|passwd|passphrase|authorization|cookie|credential|jwt|session)/i;

/** Secret-looking substrings inside free-form strings (URLs, stack traces, error messages). */
const STRING_PATTERNS: Array<[RegExp, string]> = [
  [/([?&;\s"']?(?:private_key|api_key|apikey|access_token|refresh_token|token|password|secret)=)[^&\s"'<>]+/gi, `$1${REDACTED}`],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${REDACTED}`],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, REDACTED],
  [/(:\/\/[^/\s:@]+:)[^@\s/]+(@)/g, `$1${REDACTED}$2`],
];

/** Error properties that hold whole request/response objects (headers, params, bodies) and must never be copied wholesale. */
const UNSAFE_ERROR_PROPS = new Set(["config", "request", "response", "toJSON"]);

export interface Redactor {
  redact(value: unknown): unknown;
  scrubString(value: string): string;
}

/**
 * Builds a redactor that also masks the literal values of known secrets
 * (JWT secret, Shopfa token, ...) wherever they appear inside strings,
 * regardless of the surrounding key or format.
 */
export function createRedactor(secrets: Array<string | undefined> = []): Redactor {
  const literals = secrets.filter((s): s is string => typeof s === "string" && s.length >= 8);

  function scrubString(value: string): string {
    let out = value;
    for (const literal of literals) out = out.split(literal).join(REDACTED);
    for (const [pattern, replacement] of STRING_PATTERNS) out = out.replace(pattern, replacement);
    return out;
  }

  function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERN.test(key.replace(/[-_\s]/g, ""));
  }

  /** Reduces an Error to a small safe shape; for axios errors keeps only method/URL/status, never headers, params or bodies. */
  function summarizeError(err: Error, seen: WeakSet<object>, depth: number): Record<string, unknown> {
    const out: Record<string, unknown> = {
      name: err.name,
      message: scrubString(err.message),
    };
    if (err.stack) out.stack = scrubString(err.stack);
    const anyErr = err as unknown as Record<string, unknown>;
    for (const key of Object.keys(anyErr)) {
      if (UNSAFE_ERROR_PROPS.has(key) || key in out) continue;
      out[key] = isSensitiveKey(key) ? REDACTED : walk(anyErr[key], seen, depth + 1);
    }
    const config = anyErr.config as { method?: string; url?: string; baseURL?: string } | undefined;
    if (config && typeof config === "object") {
      out.request = {
        method: config.method,
        url: typeof config.url === "string" ? scrubString(config.url) : undefined,
        baseURL: typeof config.baseURL === "string" ? scrubString(config.baseURL) : undefined,
      };
    }
    const status = (anyErr.response as { status?: unknown } | undefined)?.status;
    if (status !== undefined) out.responseStatus = status;
    if (err.cause !== undefined) out.cause = walk(err.cause, seen, depth + 1);
    return out;
  }

  function walk(value: unknown, seen: WeakSet<object>, depth: number): unknown {
    if (typeof value === "string") return scrubString(value);
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    if (depth > MAX_DEPTH) return "[Truncated]";
    seen.add(value);
    try {
      if (value instanceof Error) return summarizeError(value, seen, depth);
      if (value instanceof Date || Buffer.isBuffer(value)) return value;
      if (Array.isArray(value)) return value.map((item) => walk(item, seen, depth + 1));
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) {
        out[key] = isSensitiveKey(key) ? REDACTED : walk(inner, seen, depth + 1);
      }
      return out;
    } finally {
      seen.delete(value);
    }
  }

  return {
    redact: (value) => walk(value, new WeakSet(), 0),
    scrubString,
  };
}
