import SettingsForm from "./SettingsForm";
import Logo from "@/components/Logo";

export const metadata = { title: "Runshift — Settings" };

export default function SettingsPage() {
  return (
    <div className="settings-shell space-y-4.5">
      <div className="flex items-start justify-between mb-5 pt-1.5 gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Logo size="sm" showWordmark={false} />
            <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Training plan configuration and performance constants
          </p>
        </div>
      </div>
      <SettingsForm />
    </div>
  );
}
