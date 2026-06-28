"use client";

import Link from "next/link";
import { SettingsAccountForm } from "../../../components/settings-account-form";
import {
  SettingsPage,
  SettingsPanel,
  SettingsSection,
  useSettingsTheme
} from "../../../components/settings/settings-primitives";

export default function AccountPage() {
  const theme = useSettingsTheme();

  return (
    <SettingsPage>
      <SettingsAccountForm variant="page" />
      <SettingsPanel>
        <SettingsSection
          label="Security"
          title="Password"
          description="Change your sign-in password on the Security page."
        >
          <Link href="/settings/security" className={`inline-flex ${theme.btnGhost}`}>
            Open Security →
          </Link>
        </SettingsSection>
      </SettingsPanel>
    </SettingsPage>
  );
}
