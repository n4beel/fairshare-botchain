"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
  description?: string;
}

/**
 * Split shell: the explanation sits beside the work, not above it.
 *
 * Nobody points an income stream at a contract they have not understood, and the two facts that
 * matter — the split is permanent, payees pull rather than being pushed — are easy to scroll past
 * when they sit above a form. Here they stay in view on the left while the form is used on the
 * right. Below `lg` it stacks, explanation first, because on a phone reading precedes doing.
 */
const POINTS = [
  ["Permanent", "Payees and shares are fixed at deployment. Not even you can change them afterwards."],
  ["Pull, not push", "Each payee withdraws their own share, so one payee who cannot receive payment never blocks the others."],
  ["Applies to later money too", "Anything the address receives is divided by the same shares, forever."],
];

export default function PageShell({ children, nav = [], title, description }: PageShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh" }}>
      <header className="flex items-center justify-between gap-3 px-5 md:px-10 py-4 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span
            aria-hidden="true"
            style={{
              width: "18px", height: "18px", borderRadius: "999px",
              background: "conic-gradient(var(--accent) 0 50%, #1E6B4A 50% 80%, #14402F 80% 100%)",
            }}
          />
          <span className="text-[17px] font-semibold tracking-[-0.02em]">{app.name}</span>
        </Link>
        <div className="flex items-center gap-3">
          {nav.length > 1 && (
            <nav className="hidden sm:flex items-center gap-1">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="nav-link px-3 py-1.5 text-[13px] no-underline"
                    style={{
                      borderRadius: "8px",
                      background: active ? "var(--bg-elevated)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <NetworkBadge />
          <div style={{ width: "160px" }}><ConnectButton /></div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto px-5 md:px-10 py-8" style={{ maxWidth: "1180px" }}>
        <div className="grid gap-10 lg:gap-16" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <div className="grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div>
              {title && (
                <h1 className="text-[36px] md:text-[42px]" style={{ color: "var(--text-primary)" }}>
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-4 text-[16px]" style={{ color: "var(--text-secondary)" }}>
                  {description}
                </p>
              )}

              <dl className="mt-8 flex flex-col gap-5">
                {POINTS.map(([term, detail]) => (
                  <div key={term}>
                    <dt
                      className="text-[13px] font-medium mb-1 flex items-center gap-2"
                      style={{ color: "var(--accent)" }}
                    >
                      <span
                        aria-hidden="true"
                        style={{ width: "6px", height: "6px", borderRadius: "999px", background: "var(--accent)" }}
                      />
                      {term}
                    </dt>
                    <dd className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
                      {detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </main>

      <footer
        className="mx-auto w-full px-5 md:px-10 py-6 flex flex-wrap items-center gap-x-5 gap-y-2"
        style={{ maxWidth: "1180px", borderTop: "1px solid var(--border-subtle)" }}
      >
        <span className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>{app.tagline}</span>
        <div className="flex-1" />
        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Built on BOT Chain</span>
        <a href="https://botchain.ai" target="_blank" rel="noreferrer" className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>botchain.ai</a>
        <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer" className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>BOT Chain Explorer</a>
      </footer>
    </div>
  );
}
