import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SETTINGS_PATH = join(process.cwd(), "src", "data", "settings.json");

export interface SystemSettings {
  brandName:     string;
  brandLogoUrl:  string | null;
  vapidPublicKey: string;
}

export function readSettings(): SystemSettings {
  try {
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as SystemSettings;
  } catch {
    return { brandName: "FadilJaya.NET", brandLogoUrl: null, vapidPublicKey: "" };
  }
}

export function writeSettings(settings: SystemSettings): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}
