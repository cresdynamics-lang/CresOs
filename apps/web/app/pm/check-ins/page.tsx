"use client";

import { Suspense } from "react";
import { PmCheckInsConsole } from "../pm-check-ins-console";

export default function PmCheckInsPage() {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-sm text-slate-500">Loading check-ins…</p>}>
      <PmCheckInsConsole />
    </Suspense>
  );
}
