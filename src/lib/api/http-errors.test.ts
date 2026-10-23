import { describe, expect, it } from "vitest";
import { explainFailure, messageFrom } from "./http-errors";

describe("http errors", () => {
  it("never says just 'Request failed.'", () => {
    expect(explainFailure(504)).toMatch(/took too long to answer \(HTTP 504\).*Nothing was saved/);
    expect(explainFailure(500, "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT")).toMatch(/took too long/);
    expect(explainFailure(502)).toMatch(/could not be reached just now \(HTTP 502\)/);
    expect(explainFailure(0)).toMatch(/could not be reached just now\./);
    expect(explainFailure(413)).toMatch(/larger than the server accepts/);
    expect(explainFailure(500)).toMatch(/ran into a problem \(HTTP 500\)/);
  });

  it("keeps the API's own words when it sent them", () => {
    expect(messageFrom(422, { message: "That file is larger than 20 MB." })).toBe("That file is larger than 20 MB.");
    expect(messageFrom(504, "<html>Gateway Timeout</html>")).toMatch(/took too long/);
    expect(messageFrom(500, null)).toMatch(/HTTP 500/);
    /* A caller's own wording for an ordinary refusal with no message. */
    expect(messageFrom(400, null, "That file could not be uploaded.")).toBe("That file could not be uploaded.");
    expect(messageFrom(504, null, "That file could not be uploaded.")).toMatch(/took too long/);
  });
});
