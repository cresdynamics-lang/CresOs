"use client";

import { OnboardingConsole } from "../../../components/onboarding/onboarding-console";

export default function HrOnboardingPage() {
  return (
    <OnboardingConsole
      accent={{
        accent: "text-rose-400",
        chip: "border-white/[0.08] bg-[#0e1319] text-slate-300 hover:border-rose-500/40 hover:text-slate-100",
        button: "bg-gradient-to-br from-rose-600 to-pink-700 text-white"
      }}
    />
  );
}
