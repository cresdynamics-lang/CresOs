"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { VoiceSectionRecorder } from "./voice-section-recorder";

export type ReportSectionKey =
  | "whatWorked"
  | "blockers"
  | "needsAttention"
  | "implemented"
  | "pending"
  | "nextPlan";

export type ReportSectionField = { key: ReportSectionKey; label: string };

type DeveloperReportVoiceFormProps = {
  form: Record<ReportSectionKey, string> & { reportDate: string };
  onFormChange: (patch: Partial<DeveloperReportVoiceFormProps["form"]>) => void;
  fields: readonly ReportSectionField[];
  fieldPlaceholders: Record<ReportSectionKey, string>;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
  totalFormChars: number;
  variant?: "developer" | "crm";
};

export function DeveloperReportVoiceForm({
  form,
  onFormChange,
  fields,
  fieldPlaceholders,
  onSubmit,
  onCancel,
  submitting,
  totalFormChars,
  variant = "developer"
}: DeveloperReportVoiceFormProps) {
  const [mode, setMode] = useState<"voice" | "type">("voice");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!fields.length) return;
    if (step >= fields.length) setStep(fields.length - 1);
  }, [fields.length, step]);

  const current = fields[step] ?? fields[0];
  const isLastStep = step >= fields.length - 1;
  const canSubmit = totalFormChars >= 60 && !submitting;
  const isDeveloper = variant === "developer";

  const inputClass = isDeveloper
    ? "developer-neu w-full rounded-xl border border-[#E5E9EF] bg-white px-3 py-2.5 text-sm text-[#1A1D26] placeholder:text-[#5B6472]"
    : "w-full rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] px-3 py-2.5 text-sm text-[#1A1D26] placeholder:text-[#5B6472]";

  const labelClass = isDeveloper
    ? "text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]"
    : "text-xs font-medium uppercase tracking-wide text-[#5B6472]";

  const tabClass = (active: boolean) =>
    active
      ? "rounded-lg bg-violet-600/20 px-3 py-1.5 text-xs font-semibold text-violet-200"
      : "rounded-lg px-3 py-1.5 text-xs text-[#5B6472] hover:text-[#1A1D26]";

  const primaryBtn = isDeveloper
    ? "rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    : "rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50";

  const secondaryBtn = isDeveloper
    ? "rounded-lg border border-[#E5E9EF] px-4 py-2 text-sm text-[#5B6472]"
    : "rounded-xl border border-[#D0D5DD] px-5 py-2.5 text-sm text-[#5B6472]";

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Report date</span>
        <input
          type="date"
          value={form.reportDate}
          onChange={(e) => onFormChange({ reportDate: e.target.value })}
          className={inputClass}
          required
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9EF] pb-3">
        <div className="flex gap-1 rounded-xl border border-[#E5E9EF] p-1">
          <button type="button" className={tabClass(mode === "voice")} onClick={() => setMode("voice")}>
            Voice filing
          </button>
          <button type="button" className={tabClass(mode === "type")} onClick={() => setMode("type")}>
            Type manually
          </button>
        </div>
        <p className="text-xs text-[#5B6472]">{totalFormChars}/60 characters minimum</p>
      </div>

      {mode === "voice" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((field, index) => {
              const filled = (form[field.key]?.trim().length ?? 0) > 0;
              const active = index === step;
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
                    active
                      ? "bg-violet-600/25 text-violet-200"
                      : filled
                        ? "bg-[#F2F9EF] text-[#1B6B3A]"
                        : "bg-white/[0.04] text-[#5B6472]"
                  }`}
                >
                  {index + 1}. {field.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-[#E5E9EF] bg-black/20 p-4">
            <p className={labelClass}>
              Section {step + 1} of {fields.length}
            </p>
            <h4 className="mt-1 font-display text-lg font-semibold text-[#1A1D26]">{current.label}</h4>
            <p className="mt-1 text-xs text-[#5B6472]">{fieldPlaceholders[current.key]}</p>

            <div className="mt-4">
              <VoiceSectionRecorder
                sectionKey={current.key}
                sectionLabel={current.label}
                existingText={form[current.key]}
                onSectionText={(text) => onFormChange({ [current.key]: text })}
                disabled={submitting}
                variant={variant}
              />
            </div>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className={labelClass}>Section text (edit if needed)</span>
              <textarea
                value={form[current.key]}
                onChange={(e) => onFormChange({ [current.key]: e.target.value })}
                rows={4}
                placeholder={fieldPlaceholders[current.key]}
                className={inputClass}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className={secondaryBtn}
                >
                  Previous section
                </button>
              ) : null}
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(fields.length - 1, s + 1))}
                  className={primaryBtn}
                >
                  Next section →
                </button>
              ) : (
                <button type="submit" disabled={!canSubmit} className={primaryBtn}>
                  {submitting ? "Saving…" : "Submit report"}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[#E5E9EF] pt-4">
            <button type="button" onClick={onCancel} className={secondaryBtn}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {fields.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className={labelClass}>{label}</span>
              <textarea
                value={form[key]}
                onChange={(e) => onFormChange({ [key]: e.target.value })}
                rows={2}
                placeholder={fieldPlaceholders[key]}
                className={inputClass}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2 border-t border-[#E5E9EF] pt-4">
            <button type="submit" disabled={!canSubmit} className={primaryBtn}>
              {submitting ? "Saving…" : "Submit report"}
            </button>
            <button type="button" onClick={onCancel} className={secondaryBtn}>
              Cancel
            </button>
          </div>
        </>
      )}
    </form>
  );
}
