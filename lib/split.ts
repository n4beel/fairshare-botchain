import { getAddress, isAddress, type Address } from "viem";

/**
 * A split, as the user builds it and as the contract takes it.
 *
 * The contract stores shares as raw integers and divides by their sum, so the numbers mean
 * nothing on their own — 1/2/1 and 25/50/25 are the same split. The UI therefore shows the
 * percentage each share works out to, because that is the thing a user is actually deciding, and
 * a split that reads as "2" when they meant "2%" is the mistake available here.
 */

export const MAX_PAYEES = 50;

export type Payee = { id: string; address: string; shares: string };

export type SplitProblem = { id: string; field: "address" | "shares"; message: string };

export type ValidatedSplit = {
  payees: { address: Address; shares: bigint }[];
  problems: SplitProblem[];
  totalShares: bigint;
};

export function newPayee(): Payee {
  return { id: Math.random().toString(36).slice(2), address: "", shares: "" };
}

/** Whole positive integers only. Fractional shares are not a thing the contract can store. */
const WHOLE = /^\d+$/;

export function validateSplit(rows: Payee[]): ValidatedSplit {
  const problems: SplitProblem[] = [];
  const payees: { address: Address; shares: bigint }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const address = row.address.trim();
    const shares = row.shares.trim();

    // A row the user has started but not filled in is not an error yet.
    if (address === "" && shares === "") continue;

    if (!isAddress(address)) {
      problems.push({ id: row.id, field: "address", message: "Not an address." });
    } else {
      const checksummed = getAddress(address);
      // The contract rejects duplicates at construction, because a duplicate would double a
      // payee's claim while the released total tracked them once — the split would be silently
      // wrong. Catching it here means the user is told rather than paying gas to find out.
      if (seen.has(checksummed.toLowerCase())) {
        problems.push({ id: row.id, field: "address", message: "Already a payee in this split." });
      }
      seen.add(checksummed.toLowerCase());
    }

    if (!WHOLE.test(shares) || BigInt(shares || "0") === 0n) {
      problems.push({
        id: row.id,
        field: "shares",
        message: shares === "" ? "Needs a share." : "A whole number above zero.",
      });
    }

    if (isAddress(address) && WHOLE.test(shares) && BigInt(shares) > 0n && !problems.some((p) => p.id === row.id)) {
      payees.push({ address: getAddress(address), shares: BigInt(shares) });
    }
  }

  if (payees.length > MAX_PAYEES) {
    problems.push({
      id: rows[MAX_PAYEES]?.id ?? "",
      field: "address",
      message: `At most ${MAX_PAYEES} payees.`,
    });
  }

  return {
    payees,
    problems,
    totalShares: payees.reduce((sum, p) => sum + p.shares, 0n),
  };
}

export function isDeployable(split: ValidatedSplit): boolean {
  return split.payees.length > 0 && split.problems.length === 0;
}

/**
 * A share as a percentage, to two places.
 *
 * Computed with integers until the last step. Doing it in floating point first makes 1/3 render
 * as 33.33 while the chain pays 33.333…%, and a user comparing the two would be right to wonder
 * which is lying.
 */
export function percentOf(shares: bigint, totalShares: bigint): string {
  if (totalShares === 0n) return "0.00";
  const basisPoints = (shares * 10_000n) / totalShares;
  return (Number(basisPoints) / 100).toFixed(2);
}
