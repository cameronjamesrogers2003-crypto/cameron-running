import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import RunsClient from "./RunsClient";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const settingsRow = await prisma.userSettings.findUnique({ where: { id: 1 } });
  const settings    = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;

  const intervalThresholdSec = settings.intervalPaceMaxSec;
  const tempoThresholdSec    = settings.tempoPaceMaxSec;

  return (
    <div className="runs-shell space-y-5">
      <div className="flex items-start justify-between mb-6 pt-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Logo size="sm" showWordmark={false} />
            <h1 className="text-2xl font-bold tracking-tight text-white">Runs</h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            All activity history with filters and ratings
          </p>
        </div>
      </div>
      <RunsClient
        intervalThresholdSec={intervalThresholdSec}
        tempoThresholdSec={tempoThresholdSec}
      />
    </div>
  );
}
