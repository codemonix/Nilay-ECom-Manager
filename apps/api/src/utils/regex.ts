/** Escapes regex special characters so user-supplied search text is safe to embed in a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
