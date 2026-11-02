import type { AiTask } from "@/src/server/ai-tasks";
import type { DelegationView } from "@/src/domain/types";

export type ConversationCache = {
  tasks: AiTask[];
  delegations: DelegationView[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const storageKey = (scope: string) => `smaj-ai-conversations:v1:${scope}`;

export function readConversationCache(storage: StorageLike, scope: string): ConversationCache | null {
  try {
    const saved = storage.getItem(storageKey(scope));
    if (!saved) return null;
    const cache = JSON.parse(saved) as Partial<ConversationCache>;
    if (!Array.isArray(cache.tasks) || !Array.isArray(cache.delegations)) return null;
    return { tasks: cache.tasks as AiTask[], delegations: cache.delegations as DelegationView[] };
  } catch {
    return null;
  }
}

export function writeConversationCache(storage: StorageLike, scope: string, cache: ConversationCache): void {
  storage.setItem(storageKey(scope), JSON.stringify(cache));
}
