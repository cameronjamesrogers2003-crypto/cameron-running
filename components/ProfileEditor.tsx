"use client";

import { useState } from "react";

interface ProfileEditorProps {
  name: string;
  dob: string;
  heightCm: number;
  weightKg: number;
}

export default function ProfileEditor({ name, dob, heightCm }: ProfileEditorProps) {
  const [form, setForm] = useState({ name, dob, heightCm: String(heightCm) });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          dateOfBirth: new Date(form.dob).toISOString(),
          heightCm: parseInt(form.heightCm),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h3
        className="text-sm font-semibold uppercase tracking-wider mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Personal Details
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Name"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
        />
        <Field
          label="Date of Birth"
          type="date"
          value={form.dob}
          onChange={(v) => setForm((f) => ({ ...f, dob: v }))}
        />
        <Field
          label="Height (cm)"
          type="number"
          value={form.heightCm}
          onChange={(v) => setForm((f) => ({ ...f, heightCm: v }))}
        />
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Location
          </p>
          <p
            className="rounded-lg px-3 py-2 text-sm text-white"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            Brisbane, QLD, Australia
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-green-400">Saved!</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          colorScheme: "dark",
        }}
      />
    </div>
  );
}
