import RunsClient from "./RunsClient";

export default function RunsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Runs</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          All activity history with filters and ratings
        </p>
      </div>
      <RunsClient />
    </div>
  );
}
