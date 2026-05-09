import RunsClient from "./RunsClient";
import PageHeading from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Runs" };

export default async function RunsPage() {
  return (
    <div className="runs-shell space-y-4.5">
      <div className="flex items-start justify-between pt-2 mb-6 gap-3">
        <div>
          <PageHeading subtitle="All activity history with filters and ratings">Runs</PageHeading>
        </div>
      </div>
      <RunsClient />
    </div>
  );
}
