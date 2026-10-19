"use client";

import Link from "next/link";
import { useChainId } from "wagmi";
import Panel from "@/components/ui/Panel";
import CopyAddress from "@/components/ui/CopyAddress";
import { isBotChainId } from "@/lib/botchain/chain";
import { useSavedSplitters } from "@/lib/saved-splitters";

interface SavedSplittersProps {
  /** The splitter currently open, so the list marks it rather than linking to it. */
  current?: string | null;
}

/**
 * The splitters this browser has deployed or opened.
 *
 * Silent when empty — a first visit has nothing to list and does not need a box saying so.
 */
export default function SavedSplitters({ current = null }: SavedSplittersProps) {
  const chainId = useChainId();
  const { splitters, forget } = useSavedSplitters(isBotChainId(chainId) ? chainId : undefined);

  if (splitters.length === 0) return null;

  return (
    <Panel>
      <div className="flex flex-col gap-3">
        <span
          className="text-[10px] uppercase tracking-[0.06em]"
          style={{ color: "var(--text-secondary)" }}
        >
          Your splitters
        </span>

        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {splitters.map((s) => {
            const isCurrent = current !== null && current.toLowerCase() === s.address.toLowerCase();
            return (
              <li key={s.address} className="flex items-center gap-2 flex-wrap">
                {isCurrent ? (
                  <span
                    className="font-mono text-[12px] break-all"
                    style={{ color: "var(--text-primary)" }}
                    aria-current="true"
                  >
                    {s.address}
                  </span>
                ) : (
                  <Link
                    href={`/splitter?address=${s.address}`}
                    className="font-mono text-[12px] break-all underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {s.address}
                  </Link>
                )}

                <CopyAddress value={s.address} />

                <button
                  type="button"
                  onClick={() => forget(s.address)}
                  aria-label={`Forget ${s.address}`}
                  title="Remove from this list — the splitter itself is untouched"
                  className="text-[10px] uppercase tracking-[0.06em] cursor-pointer transition-opacity hover:opacity-70"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius)",
                    padding: "3px 7px",
                    color: "var(--text-tertiary)",
                  }}
                >
                  forget
                </button>

                {isCurrent && (
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    open
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Kept in this browser only. Forgetting one removes the shortcut, not the splitter — paste
          the address back in at any time.
        </p>
      </div>
    </Panel>
  );
}
