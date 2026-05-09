import RunsClient from "./RunsClient";
import Logo from "@/components/Logo";
import PageHeading from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Runs" };

export default async function RunsPage() {
  return (
    <div className="runs-shell space-y-4.5">
      <div className="flex items-start justify-between mb-5 pt-1.5 gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Logo size="sm" showWordmark={false} />
            <PageHeading>Runs</PageHeading>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            All activity history with filters and ratings
          </p>
        </div>
      </div>
      <RunsClient />
    </div>
  );
}
