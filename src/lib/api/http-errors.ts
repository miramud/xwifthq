/**
 * What to tell a person when a request failed and the answer was not the
 * API's own JSON: a gateway timeout page, a platform error, a dropped
 * connection. "Request failed." told nobody anything; the status says most
 * of what happened, and whether trying again is worth it.
 */
export function explainFailure(status: number, raw?: unknown): string {
  const text = typeof raw === "string" ? raw : "";

  if (status === 504 || status === 408 || /FUNCTION_INVOCATION_TIMEOUT|timed?[ -]?out/i.test(text)) {
    return `The server took too long to answer (HTTP ${status || 504}), so the request was stopped before it finished. Nothing was saved. Try again; a large document can take a few minutes.`;
  }

  if (status === 413) {
    return "That is larger than the server accepts (HTTP 413). Send a smaller file or less text.";
  }

  if (status === 502 || status === 503 || status === 0) {
    return `The server could not be reached just now${status ? ` (HTTP ${status})` : ""}. Nothing was saved. Try again in a minute.`;
  }

  if (status >= 500) {
    return `The server ran into a problem (HTTP ${status}). Nothing was saved. Try again; if it keeps happening, tell your administrator.`;
  }

  return `The request could not be completed (HTTP ${status}).`;
}

/** The API's own message when the body is its JSON, otherwise an explanation from the status. */
export function messageFrom(status: number, body: unknown, fallback?: string): string {
  if (body !== null && typeof body === "object" && typeof (body as { message?: unknown }).message === "string") {
    const message = (body as { message: string }).message.trim();
    if (message !== "") return message;
  }

  return fallback && status < 500 && status !== 0 && status !== 413 ? fallback : explainFailure(status, body);
}
