import SettingsForm from "./SettingsForm";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Training plan configuration and performance constants
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
