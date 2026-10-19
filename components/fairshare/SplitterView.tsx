"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BaseError, formatEther, isAddress, type Address, type Hex } from "viem";
import { useAccount, useChainId, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { activeBotChain, addressUrl, isBotChainId } from "@/lib/botchain/chain";
import { formatNativeAmount } from "@/lib/botchain/amount";
import { splitterAbi } from "@/lib/botchain/abi";
import { percentOf } from "@/lib/split";
import CopyAddress from "@/components/ui/CopyAddress";
import SavedSplitters from "@/components/fairshare/SavedSplitters";
import { rememberSplitter } from "@/lib/saved-splitters";

/**
 * Open any splitter by address and withdraw from it.
 *
 * Anyone can release to any payee — the contract allows it deliberately, because a payee with no
 * BOT for gas could otherwise never be paid at all. So this screen is useful connected or not: a
 * payee can claim their own, and whoever set the split up can settle on everyone's behalf.
 */
function SplitterBody() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const search = useSearchParams();
  const fromQuery = search.get("address") ?? "";

  const [typed, setTyped] = useState(fromQuery);
  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);

  useEffect(() => setTyped(fromQuery), [fromQuery]);

  const splitter = isAddress(typed.trim()) ? (typed.trim() as Address) : null;
  const ready = Boolean(splitter) && isBotChainId(chainId);

  const base = { address: splitter ?? undefined, abi: splitterAbi } as const;
  const summary = useReadContracts({
    contracts: [
      { ...base, functionName: "payees" },
      { ...base, functionName: "totalShares" },
      { ...base, functionName: "totalReceived" },
      { ...base, functionName: "totalReleased" },
    ],
    query: { enabled: ready },
  });

  const payees = summary.data?.[0]?.result as readonly Address[] | undefined;
  const totalShares = summary.data?.[1]?.result as bigint | undefined;
  const totalReceived = summary.data?.[2]?.result as bigint | undefined;
  const totalReleased = summary.data?.[3]?.result as bigint | undefined;

  const perPayee = useReadContracts({
    contracts: (payees ?? []).flatMap((payee) => [
      { ...base, functionName: "sharesOf" as const, args: [payee] },
      { ...base, functionName: "releasable" as const, args: [payee] },
      { ...base, functionName: "releasedTo" as const, args: [payee] },
    ]),
    query: { enabled: ready && Boolean(payees?.length) },
  });

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: Boolean(hash) },
  });

  const settled = useRef<Hex | null>(null);
  const refetchSummary = summary.refetch;
  const refetchPerPayee = perPayee.refetch;

  useEffect(() => {
    if (!hash || settled.current === hash) return;
    if (!receipt.isSuccess && !receipt.isError) return;
    settled.current = hash;

    if (receipt.isSuccess) {
      setStage("confirmed");
      toast("success", "Released", "The payee has been paid.");
      void refetchSummary();
      void refetchPerPayee();
    } else {
      setStage("failed");
      toast("error", "Release failed", "Nothing was paid.");
    }
  }, [hash, receipt.isSuccess, receipt.isError, toast, refetchSummary, refetchPerPayee]);

  const release = useCallback(
    async (payee: Address) => {
      if (!splitter || !isBotChainId(chainId)) return;
      setStage("signing");
      setHash(null);
      settled.current = null;

      try {
        const txHash = await writeContractAsync({
          address: splitter,
          abi: splitterAbi,
          functionName: "release",
          args: [payee],
          chainId,
        });
        setHash(txHash);
        setStage("pending");
      } catch (err) {
        setStage("idle");
        const message = err instanceof BaseError ? err.shortMessage : "Something went wrong.";
        if (/rejected|denied/i.test(message)) toast("info", "Cancelled", "Nothing was paid.");
        else toast("error", "Could not release", message);
      }
    },
    [splitter, chainId, writeContractAsync, toast],
  );

  const symbol = activeBotChain.nativeCurrency.symbol;

  // A successful read is the only proof this address is a splitter. The dependency is the payee
  // COUNT, not the array — wagmi returns a fresh array after each refetch, and depending on it
  // would re-run this every render.
  const remembered = useRef<string | null>(null);
  const payeeCount = payees?.length ?? 0;
  useEffect(() => {
    if (!splitter || !isBotChainId(chainId) || payeeCount === 0) return;
    const key = `${chainId}:${splitter.toLowerCase()}`;
    if (remembered.current === key) return;
    remembered.current = key;
    rememberSplitter(splitter, chainId);
  }, [splitter, chainId, payeeCount]);

  return (
    <div className="flex flex-col gap-4">
      <SavedSplitters current={splitter} />

      <Panel>
        <div className="flex flex-col gap-3">
          <Input
            label="Splitter address"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="0x…"
            mono
            hint="No wallet needed to look at one."
          />
          {splitter && (
            <div className="flex items-center gap-2 flex-wrap">
              <CopyAddress value={splitter} label="copy address" />
              <a href={addressUrl(chainId, splitter)} target="_blank" rel="noreferrer"
                className="text-[10px] uppercase tracking-[0.06em] underline"
                style={{ color: "var(--text-tertiary)" }}>
                explorer
              </a>
            </div>
          )}
        </div>
      </Panel>

      {ready && summary.isLoading && (
        <Panel>
          <Spinner label="Reading the chain" />
        </Panel>
      )}

      {ready && summary.isError && (
        <Panel>
          <p className="text-[12px]" style={{ color: "var(--warning)" }}>
            Could not read that address. Either it is not a splitter, or the chain did not answer.
          </p>
        </Panel>
      )}

      {ready && payees && totalShares !== undefined && (
        <>
          <Panel>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--text-secondary)" }}>
                  Received in total
                </span>
                <span className="font-mono text-[14px]" style={{ color: "var(--text-primary)" }}>
                  {formatNativeAmount(totalReceived ?? 0n)} {symbol}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  Already withdrawn
                </span>
                <span className="font-mono text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {formatNativeAmount(totalReleased ?? 0n)} {symbol}
                </span>
              </div>
            </div>
          </Panel>

          {payees.map((payee, i) => {
            const shares = perPayee.data?.[i * 3]?.result as bigint | undefined;
            const releasable = perPayee.data?.[i * 3 + 1]?.result as bigint | undefined;
            const released = perPayee.data?.[i * 3 + 2]?.result as bigint | undefined;
            const isYou = address && payee.toLowerCase() === address.toLowerCase();

            return (
              <Panel key={payee}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <a
                      href={addressUrl(chainId, payee)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[12px] break-all underline"
                      style={{ color: isYou ? "var(--accent)" : "var(--text-primary)" }}
                    >
                      {payee}
                    </a>
                    {shares !== undefined && (
                      <span className="font-mono text-[12px] flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                        {percentOf(shares, totalShares)}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      Withdrawn {formatNativeAmount(released ?? 0n)} {symbol}
                    </span>
                    <span className="font-mono text-[12px]" style={{ color: "var(--text-primary)" }}>
                      {formatNativeAmount(releasable ?? 0n)} {symbol} due
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant={isYou ? "primary" : "ghost"}
                    disabled={!releasable || releasable === 0n || stage === "signing" || stage === "pending"}
                    onClick={() => release(payee)}
                  >
                    {isYou ? "Withdraw yours" : "Release to this payee"}
                  </Button>
                </div>
              </Panel>
            );
          })}

          <Panel>
            <TxStatus stage={stage} hash={hash} confirmedLabel="Released" failedLabel="Release failed — nothing was paid." />
            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              Anyone can release to any payee — the money only ever goes to the payee. That is
              deliberate: a payee with no {symbol} for gas could otherwise never be paid.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}

export default function SplitterView() {
  return (
    <Suspense
      fallback={
        <Panel>
          <Spinner label="Loading" />
        </Panel>
      }
    >
      <SplitterBody />
    </Suspense>
  );
}
