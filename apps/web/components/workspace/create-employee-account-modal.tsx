"use client";

import { useEffect, useState } from "react";
import { hrNeu } from "../hr/hr-theme";
import { adminNeu } from "../admin/admin-theme";
import { HrFieldLabel, HrInput, HrSelect } from "../hr/hr-ui";
import { AdminFieldLabel, AdminInput, AdminSelect } from "../admin/admin-ui";

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" }
] as const;

export type CreateEmployeeAccountPayload = {
  email: string;
  name: string;
  password: string;
  roleId: string;
  reportsToDirectorId: string;
  jobTitle: string;
  employmentType: string;
  hireDate: string;
  monthlySalary: string;
};

export type RoleOption = {
  id: string;
  name: string;
  department?: { name: string } | null;
};

export type LeaderOption = {
  id: string;
  name: string | null;
  email: string;
};

type CreateEmployeeAccountModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateEmployeeAccountPayload) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  roles: RoleOption[];
  leaders: LeaderOption[];
  theme?: "hr" | "admin";
  eyebrow?: string;
  title?: string;
  submitLabel?: string;
  rolePlaceholder?: string;
  leaderPlaceholder?: string;
};

const EMPTY_FORM: CreateEmployeeAccountPayload = {
  email: "",
  name: "",
  password: "",
  roleId: "",
  reportsToDirectorId: "",
  jobTitle: "",
  employmentType: "full_time",
  hireDate: new Date().toISOString().slice(0, 10),
  monthlySalary: ""
};

export function CreateEmployeeAccountModal({
  open,
  onClose,
  onSubmit,
  busy = false,
  error = null,
  roles,
  leaders,
  theme = "hr",
  eyebrow = "New hire",
  title = "Create employee account",
  submitLabel = "Create employee",
  rolePlaceholder = "Select role",
  leaderPlaceholder = "Director or admin (optional)"
}: CreateEmployeeAccountModalProps) {
  const [form, setForm] = useState<CreateEmployeeAccountPayload>(EMPTY_FORM);
  const neu = theme === "admin" ? adminNeu : hrNeu;
  const accentEyebrow = theme === "admin" ? "text-indigo-400/80" : "text-rose-400/80";
  const accentError = "border-rose-500/30 bg-rose-950/40 text-rose-200";

  useEffect(() => {
    if (!open) setForm({ ...EMPTY_FORM, hireDate: new Date().toISOString().slice(0, 10) });
  }, [open]);

  if (!open) return null;

  const FieldLabel = theme === "admin" ? AdminFieldLabel : HrFieldLabel;
  const Input = theme === "admin" ? AdminInput : HrInput;
  const Select = theme === "admin" ? AdminSelect : HrSelect;

  function patch<K extends keyof CreateEmployeeAccountPayload>(key: K, value: CreateEmployeeAccountPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm({ ...EMPTY_FORM, hireDate: new Date().toISOString().slice(0, 10) });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(form);
        }}
        className={`${neu.panel} ${theme === "hr" ? "hr-neu" : "admin-neu"} w-full max-w-2xl max-h-[92dvh] overflow-y-auto`}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${accentEyebrow}`}>{eyebrow}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-100">{title}</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error ? (
          <p className={`mb-4 rounded-lg border px-3 py-2 text-xs ${accentError}`}>{error}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Work email</FieldLabel>
            <Input type="email" value={form.email} onChange={(e) => patch("email", e.target.value)} required />
          </div>
          <div>
            <FieldLabel>Full name</FieldLabel>
            <Input type="text" value={form.name} onChange={(e) => patch("name", e.target.value)} />
          </div>
          <div>
            <FieldLabel>Temporary password</FieldLabel>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => patch("password", e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <FieldLabel>Role / team</FieldLabel>
            <Select value={form.roleId} onChange={(e) => patch("roleId", e.target.value)}>
              <option value="">{rolePlaceholder}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.department ? ` — ${r.department.name}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Reports to</FieldLabel>
            <Select value={form.reportsToDirectorId} onChange={(e) => patch("reportsToDirectorId", e.target.value)}>
              <option value="">{leaderPlaceholder}</option>
              {leaders.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? d.email}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Job title</FieldLabel>
            <Input type="text" value={form.jobTitle} onChange={(e) => patch("jobTitle", e.target.value)} />
          </div>
          <div>
            <FieldLabel>Employment type</FieldLabel>
            <Select value={form.employmentType} onChange={(e) => patch("employmentType", e.target.value)}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Hire date</FieldLabel>
            <Input type="date" value={form.hireDate} onChange={(e) => patch("hireDate", e.target.value)} />
          </div>
          <div>
            <FieldLabel>Monthly salary (KES)</FieldLabel>
            <Input
              type="number"
              min={0}
              step={1000}
              value={form.monthlySalary}
              onChange={(e) => patch("monthlySalary", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={handleClose} className={neu.btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={neu.btnPrimary}>
            {busy ? "Creating…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
