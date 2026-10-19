"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { isAddress, type Address } from "viem";

/**
 * The splitters this browser has seen.
 *
 * A splitter has no registry to look itself up in: the factory emits an address once, and after
 * that the only way back to it is to know the address. That address is also the one a payer sends
 * money to, so losing it is worse here than in most apps — every splitter created or opened is
 * kept in localStorage and listed on both pages.
 *
 * This is a convenience, not a source of truth. It lives in one browser, it is never read back by
 * the contract, and a splitter missing from it is still perfectly real — which is why the address
 * field stays, and why forgetting one only removes the shortcut.
 */

const KEY = "fairshare.splitters.v1";

export interface SavedSplitter {
  address: Address;
  chainId: number;
  /** Unix ms, so the list can show the newest first. */
  savedAt: number;
}

const listeners = new Set<() => void>();

/**
 * The raw JSON string, not the parsed array: a snapshot must be referentially stable or
 * useSyncExternalStore re-renders forever. Callers parse it behind a useMemo.
 */
let snapshot = "[]";
let loaded = false;

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    // Private windows and blocked site data both throw here. The app works without the list.
    return "[]";
  }
}

function parse(raw: string): SavedSplitter[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (w): w is SavedSplitter =>
        typeof w === "object" && w !== null &&
        typeof (w as SavedSplitter).address === "string" && isAddress((w as SavedSplitter).address) &&
        typeof (w as SavedSplitter).chainId === "number" &&
        typeof (w as SavedSplitter).savedAt === "number",
    );
  } catch {
    return [];
  }
}

function write(next: SavedSplitter[]): void {
  const raw = JSON.stringify(next);
  snapshot = raw;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Out of quota, or storage blocked. The in-memory snapshot still serves this page view.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab of the same app writing the key.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== KEY) return;
    snapshot = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string {
  if (!loaded) {
    snapshot = read();
    loaded = true;
  }
  return snapshot;
}

/** The server renders an empty list; the real one arrives on hydration. */
function getServerSnapshot(): string {
  return "[]";
}

/** Remember a splitter, newest first. Re-saving one it knows just moves it to the top. */
export function rememberSplitter(address: Address, chainId: number): void {
  const current = parse(getSnapshot());
  const rest = current.filter(
    (w) => !(w.address.toLowerCase() === address.toLowerCase() && w.chainId === chainId),
  );
  write([{ address, chainId, savedAt: Date.now() }, ...rest]);
}

export function forgetSplitter(address: Address, chainId: number): void {
  const current = parse(getSnapshot());
  write(
    current.filter(
      (w) => !(w.address.toLowerCase() === address.toLowerCase() && w.chainId === chainId),
    ),
  );
}

/**
 * The splitters saved for `chainId`, newest first. A splitter deployed on Bohr does not exist on
 * mainnet, so the list is always filtered by the chain the page is pointed at.
 */
export function useSavedSplitters(chainId: number | undefined): {
  splitters: SavedSplitter[];
  forget: (address: Address) => void;
} {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const splitters = useMemo(
    () => (chainId === undefined ? [] : parse(raw).filter((w) => w.chainId === chainId)),
    [raw, chainId],
  );

  const forget = useCallback(
    (address: Address) => {
      if (chainId !== undefined) forgetSplitter(address, chainId);
    },
    [chainId],
  );

  return { splitters, forget };
}
