"use client";

import { useState, useEffect, useCallback } from "react";
import { INTERRUPTION_TYPE_LABEL, parseInterruptionType, type InterruptionType } from "@/lib/interruptions";

interface InterruptionRow {
  id: string;
  reason: string;
  type: string;
  startDate: string;
  endDate: string | null;
  weeklyKmEstimate: number | null;
  notes: string | null;
  weeksAffected: number | null;
  createdAt: string;
}

const TYPE_OPTIONS: { value: InterruptionType; label: string }[] = [
  { value: "break",        label: "Training break" },
  { value: "illness",      label: "Illness" },
  { value: "injury",       label: "Injury" },
  { value: "reduced_load", label: "Reduced load" },
];

const BLANK_FORM: {
  reason: string;
  type: InterruptionType;
  startDate: string;
  endDate: string;
  weeksAffected: string;
  weeklyKmEstimate: string;
  notes: string;
} = {
  reason:           "",
  type:             "break",
  startDate:        "",
  endDate:          "",
  weeksAffected:    "",
  weeklyKmEstimate: "",
  notes:            "",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export default function InterruptionsForm() {
  const token = process.env.NEXT_PUBLIC_PLANS_API_TOKEN;
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const [rows, setRows]           = useState<InterruptionRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(BLANK_FORM);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch("/api/interruptions");
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function setField(key: keyof typeof BLANK_FORM, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleAdd() {
    if (!form.reason.trim() || !form.startDate) {
      setSaveMsg("Reason and start date are required.");
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        reason:    form.reason.trim(),
        type:      form.type,
        startDate: form.startDate,
        endDate:   form.endDate || null,
        notes:     form.notes.trim() || null,
        weeksAffected:    form.weeksAffected    ? parseInt(form.weeksAffected, 10)    : null,
        weeklyKmEstimate: form.weeklyKmEstimate ? parseFloat(form.weeklyKmEstimate) : null,
      };
      const res = await fetch("/api/interruptions", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setForm(BLANK_FORM);
      setSaveMsg("Saved");
      await fetchRows();
    } catch {
      setSaveMsg("Error saving.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 2500);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/interruptions/${id}`, { method: "DELETE", headers: authHeader });
      setRows(prev => prev.filter(r => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    color: "#fff",
    padding: "6px 10px",
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div
      className="rounded-[10px] p-5 space-y-5"
      style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
        Plan Interruptions
      </p>

      {/* Add form */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-white">Log an interruption</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Reason</label>
            <input
              type="text"
              placeholder="e.g. Knee tendinopathy"
              value={form.reason}
              onChange={e => setField("reason", e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Type</label>
            <select
              value={form.type}
              onChange={e => setField("type", e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setField("startDate", e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>End date (optional)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setField("endDate", e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Weeks affected
              <span style={{ color: "rgba(232,230,224,0.3)" }}> (overrides dates)</span>
            </label>
            <input
              type="number"
              min={0}
              max={52}
              placeholder="Auto"
              value={form.weeksAffected}
              onChange={e => setField("weeksAffected", e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          {form.type === "reduced_load" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Avg km/week during break</label>
              <input
                type="number"
                min={0}
                max={150}
                step={0.5}
                placeholder="e.g. 15"
                value={form.weeklyKmEstimate}
                onChange={e => setField("weeklyKmEstimate", e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>Notes (optional)</label>
          <textarea
            placeholder="Any details worth remembering…"
            value={form.notes}
            onChange={e => setField("notes", e.target.value)}
            rows={2}
            style={{ ...inputStyle, width: "100%", resize: "vertical" }}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end pt-1">
          {saveMsg && (
            <span
              className="text-xs"
              style={{ color: saveMsg === "Saved" ? "#5DCAA5" : "#F09595" }}
            >
              {saveMsg}
            </span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="min-h-11 px-4 py-2 rounded-md text-sm font-medium w-full sm:w-auto"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: saving ? "var(--text-muted)" : "var(--accent)",
            }}
          >
            {saving ? "Saving…" : "Add interruption"}
          </button>
        </div>
      </div>

      {/* History table */}
      {!loading && rows.length > 0 && (
        <div className="space-y-2 pt-1">
          <div
            className="h-px"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <p className="text-xs font-medium text-white pt-1">History</p>
          <div className="space-y-1.5">
            {rows.map(row => (
              <div
                key={row.id}
                className="rounded-md px-3 py-2.5 flex items-start justify-between gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
                    >
                      {INTERRUPTION_TYPE_LABEL[parseInterruptionType(row.type)]}
                    </span>
                    <span className="text-xs text-white">{row.reason}</span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {fmtDate(row.startDate)}
                    {row.endDate ? ` → ${fmtDate(row.endDate)}` : " (ongoing)"}
                    {row.weeksAffected != null && ` · ${row.weeksAffected}w affected`}
                    {row.weeklyKmEstimate != null && ` · ${row.weeklyKmEstimate} km/w`}
                  </p>
                  {row.notes && (
                    <p className="text-[11px] mt-0.5 italic" style={{ color: "rgba(232,230,224,0.3)" }}>
                      {row.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  disabled={deletingId === row.id}
                  className="shrink-0 min-h-11 text-[11px] px-3 py-2 rounded"
                  style={{
                    color: "rgba(232,230,224,0.3)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {deletingId === row.id ? "…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-xs" style={{ color: "rgba(232,230,224,0.25)" }}>
          No interruptions logged. Add one above if you need to take a break from training.
        </p>
      )}
    </div>
  );
}
