"use client";

import { OnboardingConsole } from "../../../components/onboarding/onboarding-console";

export default function AdminOnboardingPage() {
  return (
    <OnboardingConsole
      accent={{
        accent: "text-indigo-400",
        chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-indigo-500/40 hover:text-slate-100",
        button: "bg-gradient-to-br from-indigo-600 to-violet-700 text-white"
      }}
    />
  );
}
