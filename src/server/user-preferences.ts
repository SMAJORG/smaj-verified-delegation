import type { AppDatabase } from "@/src/server/database";
import { getDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";

export class UserPreferencesStore {
  constructor(private readonly database: AppDatabase = getDatabase()) {}

  get(ownerId: string): string[] {
    const row = this.database.prepare("SELECT preferences_json FROM ai_user_preferences WHERE owner_id = ?").get(ownerId) as { preferences_json: string } | undefined;
    if (!row) return [];
    try {
      const value: unknown = JSON.parse(row.preferences_json);
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 10) : [];
    } catch {
      throw new AppError("preferences_corrupt", "Saved preferences could not be read. Please update them.", 500);
    }
  }

  save(ownerId: string, input: unknown): string[] {
    if (!Array.isArray(input) || input.length > 10 || input.some(item => typeof item !== "string" || item.trim().length > 120)) {
      throw new AppError("invalid_preferences", "Save up to 10 preferences, each 120 characters or fewer.", 400);
    }
    const preferences = Array.from(new Set(input.map(item => (item as string).trim()).filter(Boolean)));
    this.database.prepare("INSERT INTO ai_user_preferences (owner_id, preferences_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET preferences_json = excluded.preferences_json, updated_at = excluded.updated_at")
      .run(ownerId, JSON.stringify(preferences), new Date().toISOString());
    return preferences;
  }
}
