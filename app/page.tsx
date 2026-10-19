import PageShell from "@/components/layout/PageShell";
import BotChainGate from "@/components/botchain/BotChainGate";
import CreateSplit from "@/components/fairshare/CreateSplit";
import SavedSplitters from "@/components/fairshare/SavedSplitters";
import { NAV } from "@/lib/nav";

export default function Home() {
  return (
    <PageShell
      nav={NAV}
      title="Split every payment"
      description="Deploy an address that divides whatever it receives, by shares you set once and nobody can change."
    >
      <div className="flex flex-col gap-4">
        {/* Outside the gate: looking up a splitter you already deployed needs no extension. */}
        <SavedSplitters />

        <BotChainGate>
          <CreateSplit />
        </BotChainGate>
      </div>
    </PageShell>
  );
}
