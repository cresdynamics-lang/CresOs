"use client";

import { OnboardingConsole } from "../../../components/onboarding/onboarding-console";

export default function FinanceOnboardingPage() {
  return (
    <OnboardingConsole
      accent={{
        accent: "text-emerald-400",
        chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-emerald-500/40 hover:text-slate-100",
        button: "bg-gradient-to-br from-emerald-600 to-teal-700 text-white"
      }}
    />
  );
}
