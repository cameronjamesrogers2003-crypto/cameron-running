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
    <div className="rs-page rs-page--runs">
      <div className="rs-page__head">
        <div>
          <p className="rs-page__greeting">Runs</p>
          <h1 className="rs-page__title">Your log</h1>
          <p className="rs-page__date">All activity history with filters and ratings</p>
        </div>
        <div>
          <Logo size="sm" showWordmark={false} />
        </div>
      </div>
      <RunsClient
        intervalThresholdSec={intervalThresholdSec}
        tempoThresholdSec={tempoThresholdSec}
      />
    </div>
  );
}
