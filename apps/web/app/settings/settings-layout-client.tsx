"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../auth-context";
import { SettingsThemeProvider } from "../../components/settings/settings-primitives";
import {
  SettingsPageChrome,
  SettingsWorkspaceShell
} from "../../components/settings/settings-workspace-shell";
import { SettingsTabsNav } from "../../components/settings/settings-tabs-nav";
import { resolveSettingsWorkspace } from "../../lib/resolve-settings-workspace";
import { SETTINGS_TAB_COPY } from "./settings-nav";

function SettingsLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const workspaceKey = resolveSettingsWorkspace(auth.roleKeys);
  const copy = SETTINGS_TAB_COPY[pathname] ?? {
    title: "Settings",
    description: "Manage your workspace profile and preferences."
  };

  return (
    <SettingsWorkspaceShell workspaceKey={workspaceKey}>
      <SettingsPageChrome
        workspaceKey={workspaceKey}
        title={copy.title}
        description={copy.description}
        tabs={<SettingsTabsNav compact={workspaceKey !== "global"} />}
      >
        {children}
      </SettingsPageChrome>
    </SettingsWorkspaceShell>
  );
}

export function SettingsLayoutClient({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const workspaceKey = resolveSettingsWorkspace(auth.roleKeys);

  return (
    <SettingsThemeProvider workspaceKey={workspaceKey}>
      <SettingsLayoutInner>{children}</SettingsLayoutInner>
    </SettingsThemeProvider>
  );
}
