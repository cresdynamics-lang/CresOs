"use client";

import { OnboardingConsole } from "../../../components/onboarding/onboarding-console";

export default function PmOnboardingPage() {
  return (
    <OnboardingConsole
      accent={{
        accent: "text-teal-400",
        chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-teal-500/40 hover:text-slate-100",
        button: "bg-gradient-to-br from-teal-600 to-cyan-700 text-white"
      }}
    />
  );
}
