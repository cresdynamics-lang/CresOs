"use client";

import { OnboardingConsole } from "../../../components/onboarding/onboarding-console";

export default function DeveloperOnboardingPage() {
  return (
    <OnboardingConsole
      accent={{
        accent: "text-sky-400",
        chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-sky-500/40 hover:text-slate-100",
        button: "bg-gradient-to-br from-sky-600 to-cyan-700 text-white"
      }}
    />
  );
}
