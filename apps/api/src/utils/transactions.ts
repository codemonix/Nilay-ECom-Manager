/**
 * MongoDB multi-document transactions require a replica set (or mongos).
 * A single-node standalone `mongod` -- the default for local development
 * with the docker-compose service in this repo -- does not support them
 * and throws an error containing this message when a transaction is
 * attempted. Callers use this to detect that case and fall back to
 * sequential writes with manual compensation, so Case/CaseEvent
 * consistency is preserved either way. See docs/database.md.
 */
export function isTransactionsUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("Transaction numbers are only allowed on a replica set") ||
    message.includes("Transactions are not supported") ||
    message.includes("IllegalOperation")
  );
}
