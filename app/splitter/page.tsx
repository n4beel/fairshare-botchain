import PageShell from "@/components/layout/PageShell";
import SplitterView from "@/components/fairshare/SplitterView";
import { NAV } from "@/lib/nav";

export const metadata = {
  title: "Open a splitter — Fairshare",
  description: "Look at any splitter on BOT Chain and withdraw what you are owed.",
};

export default function SplitterPage() {
  return (
    <PageShell nav={NAV} title="Open a splitter" description="Paste its address to see the split and what each payee is owed.">
      <SplitterView />
    </PageShell>
  );
}
