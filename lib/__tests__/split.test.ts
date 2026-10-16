import { describe, expect, it } from "vitest";
import { isDeployable, newPayee, percentOf, validateSplit, type Payee } from "../split";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";

function rows(...pairs: [string, string][]): Payee[] {
  return pairs.map(([address, shares], i) => ({ id: String(i), address, shares }));
}

describe("validateSplit", () => {
  it("accepts a sound split", () => {
    const split = validateSplit(rows([A, "50"], [B, "50"]));
    expect(split.problems).toEqual([]);
    expect(split.totalShares).toBe(100n);
    expect(isDeployable(split)).toBe(true);
  });

  it("ignores a row the user has not started", () => {
    const split = validateSplit([...rows([A, "1"]), newPayee()]);
    expect(split.problems).toEqual([]);
    expect(split.payees).toHaveLength(1);
  });

  it("rejects a bad address", () => {
    const split = validateSplit(rows(["0xnope", "1"]));
    expect(split.problems[0].field).toBe("address");
    expect(isDeployable(split)).toBe(false);
  });

  // The contract rejects duplicates at construction: one would double a payee's claim while the
  // released total tracked them once, making the split silently wrong.
  it("rejects a duplicate payee, however it is spelled", () => {
    const split = validateSplit(rows([A, "1"], [A.toUpperCase().replace("0X", "0x"), "1"]));
    expect(split.problems.some((p) => /already a payee/i.test(p.message))).toBe(true);
    expect(isDeployable(split)).toBe(false);
  });

  it("rejects zero, fractional and non-numeric shares", () => {
    expect(validateSplit(rows([A, "0"])).problems[0].field).toBe("shares");
    expect(validateSplit(rows([A, "1.5"])).problems[0].field).toBe("shares");
    expect(validateSplit(rows([A, "abc"])).problems[0].field).toBe("shares");
    expect(validateSplit(rows([A, "-1"])).problems[0].field).toBe("shares");
  });

  it("is not deployable when empty", () => {
    expect(isDeployable(validateSplit([]))).toBe(false);
    expect(isDeployable(validateSplit([newPayee()]))).toBe(false);
  });

  it("rejects more payees than the contract takes", () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: String(i),
      address: `0x${String(i + 1).padStart(40, "0")}`,
      shares: "1",
    }));
    expect(isDeployable(validateSplit(many))).toBe(false);
  });

  it("accepts exactly the maximum", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      address: `0x${String(i + 1).padStart(40, "0")}`,
      shares: "1",
    }));
    expect(isDeployable(validateSplit(many))).toBe(true);
  });
});

describe("percentOf", () => {
  it("shows what a share actually works out to", () => {
    expect(percentOf(50n, 100n)).toBe("50.00");
    expect(percentOf(1n, 3n)).toBe("33.33");
    expect(percentOf(1n, 8n)).toBe("12.50");
  });

  // Shares are meaningless on their own — 1/2/1 and 25/50/25 are the same split — so the
  // percentage is the thing the user is deciding.
  it("treats proportional splits identically", () => {
    expect(percentOf(1n, 4n)).toBe(percentOf(25n, 100n));
    expect(percentOf(2n, 4n)).toBe(percentOf(50n, 100n));
  });

  it("does not divide by zero", () => {
    expect(percentOf(1n, 0n)).toBe("0.00");
  });

  it("stays exact for large share counts", () => {
    // Computed with integers until the last step; floating point first would drift here.
    expect(percentOf(10n ** 18n, 3n * 10n ** 18n)).toBe("33.33");
  });
});
