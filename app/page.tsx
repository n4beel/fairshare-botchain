import PageShell from "@/components/layout/PageShell";
import BotChainGate from "@/components/botchain/BotChainGate";
import CreateSplit from "@/components/fairshare/CreateSplit";
import { NAV } from "@/lib/nav";

export default function Home() {
  return (
    <PageShell
      nav={NAV}
      title="Split every payment"
      description="Deploy an address that divides whatever it receives, by shares you set once and nobody can change."
    >
      <BotChainGate>
        <CreateSplit />
      </BotChainGate>
    </PageShell>
  );
}
