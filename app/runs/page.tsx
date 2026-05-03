import RunsClient from "./RunsClient";
import Logo from "@/components/Logo";

export default function RunsPage() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Logo size="sm" showWordmark={false} />
          <h1 className="text-xl font-bold text-white">Runs</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          All activity history with filters and ratings
        </p>
      </div>
      <RunsClient />
    </div>
  );
}
