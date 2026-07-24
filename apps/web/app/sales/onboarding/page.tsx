"use client";

import { OnboardingConsole } from "../../../components/onboarding/onboarding-console";

export default function SalesOnboardingPage() {
  return (
    <OnboardingConsole
      accent={{
        accent: "text-amber-400",
        chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-amber-500/40 hover:text-slate-100",
        button: "bg-gradient-to-br from-amber-600 to-orange-700 text-white"
      }}
    />
  );
}
