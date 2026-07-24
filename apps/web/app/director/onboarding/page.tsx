"use client";

import { OnboardingConsole } from "../../../components/onboarding/onboarding-console";

export default function DirectorOnboardingPage() {
  return (
    <OnboardingConsole
      accent={{
        accent: "text-violet-400",
        chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-violet-500/40 hover:text-slate-100",
        button: "bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white"
      }}
    />
  );
}
