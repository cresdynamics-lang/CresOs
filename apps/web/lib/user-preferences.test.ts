/**
 * Run: npx tsx apps/web/lib/user-preferences.test.ts
 */
import assert from "node:assert/strict";
import {
  DEFAULT_USER_PREFERENCES,
  normalizeUserPreferences,
  preferencesSnapshot
} from "./user-preferences";

const partial = {
  theme: "auto",
  language: "sw",
  timezone: "Europe/London",
  notifications: { email: false, desktop: true },
  privacy: { showLastSeen: true, profileVisibility: "team" },
  accessibility: { fontSize: "large", reduceMotion: true }
};

const merged = normalizeUserPreferences(partial);
assert.equal(merged.theme, "auto");
assert.equal(merged.language, "sw");
assert.equal(merged.timezone, "Europe/London");
assert.equal(merged.notifications.email, false);
assert.equal(merged.notifications.push, true);
assert.equal(merged.notifications.desktop, true);
assert.equal(merged.privacy.showLastSeen, true);
assert.equal(merged.privacy.profileVisibility, "team");
assert.equal(merged.accessibility.fontSize, "large");
assert.equal(merged.accessibility.reduceMotion, true);

const invalid = normalizeUserPreferences({
  theme: "neon",
  accessibility: { fontSize: "huge" },
  privacy: { profileVisibility: "public" }
});
assert.equal(invalid.theme, "dark");
assert.equal(invalid.accessibility.fontSize, "medium");
assert.equal(invalid.privacy.profileVisibility, "all");

assert.notEqual(preferencesSnapshot(DEFAULT_USER_PREFERENCES), preferencesSnapshot(merged));

console.log("user-preferences.test.ts: all assertions passed");
