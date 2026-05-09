import SettingsForm from "./SettingsForm";
import PageHeading from "@/components/ui/PageHeading";

export const metadata = { title: "Runshift — Settings" };

export default function SettingsPage() {
  return (
    <div className="settings-shell space-y-4.5">
      <div className="flex items-start justify-between pt-2 mb-6 gap-3">
        <div>
          <PageHeading subtitle="Training plan configuration and performance constants">Settings</PageHeading>
        </div>
      </div>
      <SettingsForm />
    </div>
  );
}
