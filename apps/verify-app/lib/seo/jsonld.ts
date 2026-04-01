export function safeJsonLd<T>(data: T): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
