import { describe, expect, it } from "vitest";
import { checkBreached, passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("requires at least 10 characters", () => {
    expect(passwordProblem("short")).toBe("too_short");
    expect(passwordProblem("123456789")).toBe("too_short");
    expect(passwordProblem("1234567890")).toBeNull();
  });
});

// SHA-1 of "password" is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
describe("checkBreached", () => {
  it("sends only the first five hash characters and finds the suffix", async () => {
    const calls: string[] = [];
    const fake = async (url: string) => {
      calls.push(url);
      return new Response("0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n");
    };
    const result = await checkBreached("password", fake as unknown as typeof fetch);
    expect(calls).toEqual(["https://api.pwnedpasswords.com/range/5BAA6"]);
    expect(result).toEqual({ breached: true, count: 9545824 });
  });
  it("reports not breached when the suffix is absent", async () => {
    const fake = async () => new Response("0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n");
    expect(await checkBreached("password", fake as unknown as typeof fetch)).toEqual({ breached: false, count: 0 });
  });
  it("fails open when the service is unreachable or errors", async () => {
    const boom = async () => {
      throw new Error("network");
    };
    expect(await checkBreached("password", boom as unknown as typeof fetch)).toEqual({ breached: false, count: 0 });
    const bad = async () => new Response("no", { status: 503 });
    expect(await checkBreached("password", bad as unknown as typeof fetch)).toEqual({ breached: false, count: 0 });
  });
});
