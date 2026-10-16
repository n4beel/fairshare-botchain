"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaseError, ContractFunctionRevertedError, decodeEventLog, type Hex } from "viem";
import { useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { addressUrl, isBotChainId } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { splitterFactoryAbi } from "@/lib/botchain/abi";
import { isDeployable, MAX_PAYEES, newPayee, percentOf, validateSplit, type Payee } from "@/lib/split";

/**
 * Build a split and deploy it.
 *
 * Percentages are shown next to every share as they are typed. Shares are raw integers on chain
 * and mean nothing on their own — 1/2/1 and 25/50/25 are the same split — so the percentage is
 * what the user is really deciding, and seeing it is what stops "2" being entered for "2%".
 */
export default function CreateSplit() {
  const chainId = useChainId();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [rows, setRows] = useState<Payee[]>([newPayee(), newPayee()]);
  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [splitter, setSplitter] = useState<Hex | null>(null);

  const deployment = isBotChainId(chainId) ? getDeployment(chainId) : null;
  const split = useMemo(() => validateSplit(rows), [rows]);
  const ready = isDeployable(split);

  const problemFor = (id: string, field: "address" | "shares") =>
    split.problems.find((p) => p.id === id && p.field === field)?.message;

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: Boolean(hash) },
  });

  const settled = useRef<Hex | null>(null);
  useEffect(() => {
    if (!hash || settled.current === hash) return;
    if (!receipt.isSuccess && !receipt.isError) return;
    settled.current = hash;

    if (receipt.isError) {
      setStage("failed");
      toast("error", "Deployment failed", "No splitter was created.");
      return;
    }

    // The splitter's address is in the log, not the return data — a receipt carries logs only.
    let created: Hex | null = null;
    for (const log of receipt.data?.logs ?? []) {
      try {
        const parsed = decodeEventLog({ abi: splitterFactoryAbi, ...log });
        if (parsed.eventName === "SplitterCreated") created = parsed.args.splitter;
      } catch {
        // Not our log.
      }
    }

    setSplitter(created);
    setStage("confirmed");
    toast("success", "Splitter deployed", "Send BOT to it and the shares apply automatically.");
  }, [hash, receipt.isSuccess, receipt.isError, receipt.data, toast]);

  const handleCreate = useCallback(async () => {
    if (!deployment || !isBotChainId(chainId) || !ready) return;

    setStage("signing");
    setHash(null);
    setSplitter(null);
    settled.current = null;

    try {
      const txHash = await writeContractAsync({
        address: deployment.address,
        abi: splitterFactoryAbi,
        functionName: "create",
        args: [split.payees.map((p) => p.address), split.payees.map((p) => p.shares)],
        chainId,
      });
      setHash(txHash);
      setStage("pending");
    } catch (err) {
      setStage("idle");

      const reverted =
        err instanceof BaseError ? err.walk((e) => e instanceof ContractFunctionRevertedError) : null;
      if (reverted instanceof ContractFunctionRevertedError) {
        toast("error", "Refused", reverted.data?.errorName ?? "The contract did not say why.");
        return;
      }

      const message = err instanceof BaseError ? err.shortMessage : "Something went wrong.";
      if (/rejected|denied/i.test(message)) toast("info", "Cancelled", "Nothing was deployed.");
      else toast("error", "Could not deploy", message);
    }
  }, [deployment, chainId, ready, split, writeContractAsync, toast]);

  if (stage === "confirmed") {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <TxStatus stage="confirmed" hash={hash} confirmedLabel="Splitter deployed" />

          {splitter && (
            <>
              <div className="flex flex-col gap-1">
                <span
                  className="text-[10px] uppercase tracking-[0.06em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Send payments to
                </span>
                <a
                  href={addressUrl(chainId, splitter)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[12px] break-all underline"
                  style={{ color: "var(--accent)" }}
                >
                  {splitter}
                </a>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                Anything sent to that address is divided by the shares you set. Payees withdraw
                whenever they like — nothing is pushed to them, so one payee who cannot receive
                payment never blocks the others. The configuration is permanent: not even you can
                change the payees or redirect it.
              </p>

              <Link
                href={`/splitter?address=${splitter}`}
                className="text-[11px] uppercase tracking-[0.04em] underline"
                style={{ color: "var(--accent)" }}
              >
                Open it
              </Link>
            </>
          )}
        </div>
      </Panel>
    );
  }

  const busy = stage === "signing" || stage === "pending";

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-4">
          {rows.map((row, i) => (
            <div key={row.id} className="grid gap-3" style={{ gridTemplateColumns: "1fr 110px 32px" }}>
              <Input
                label={i === 0 ? "Payee" : undefined}
                value={row.address}
                onChange={(e) =>
                  setRows(rows.map((r) => (r.id === row.id ? { ...r, address: e.target.value } : r)))
                }
                placeholder="0x…"
                mono
                disabled={busy}
                error={problemFor(row.id, "address")}
              />
              <Input
                label={i === 0 ? "Shares" : undefined}
                value={row.shares}
                onChange={(e) =>
                  setRows(rows.map((r) => (r.id === row.id ? { ...r, shares: e.target.value } : r)))
                }
                placeholder="50"
                mono
                disabled={busy}
                error={problemFor(row.id, "shares")}
                hint={
                  split.totalShares > 0n && /^\d+$/.test(row.shares.trim()) && row.shares.trim() !== "0"
                    ? `${percentOf(BigInt(row.shares.trim()), split.totalShares)}%`
                    : undefined
                }
              />
              <button
                aria-label={`Remove payee ${i + 1}`}
                onClick={() => setRows(rows.length > 1 ? rows.filter((r) => r.id !== row.id) : rows)}
                disabled={busy || rows.length === 1}
                className="self-start"
                style={{
                  marginTop: i === 0 ? "26px" : "0",
                  height: "42px",
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "4px",
                  color: "var(--text-tertiary)",
                  cursor: rows.length === 1 ? "not-allowed" : "pointer",
                  opacity: rows.length === 1 ? 0.4 : 1,
                }}
              >
                ×
              </button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRows([...rows, newPayee()])}
            disabled={busy || rows.length >= MAX_PAYEES}
          >
            Add a payee
          </Button>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3">
          {split.payees.length > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-[11px] uppercase tracking-[0.06em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {split.payees.length} {split.payees.length === 1 ? "payee" : "payees"}
              </span>
              <span className="font-mono text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {split.totalShares.toString()} shares total
              </span>
            </div>
          )}

          {stage === "idle" || stage === "failed" ? (
            <Button onClick={handleCreate} disabled={!ready}>
              {ready ? "Deploy splitter" : "Add payees to continue"}
            </Button>
          ) : null}

          <TxStatus stage={stage} hash={hash} failedLabel="Deployment failed — no splitter exists." />

          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Shares are proportions, not percentages — 1 and 2 splits the same way as 33 and 67. The
            percentage next to each one is what it actually works out to.
          </p>
        </div>
      </Panel>
    </div>
  );
}
