import { requireActorSession } from "@/src/server/auth";
import { getDatabase } from "@/src/server/database";
export const workspaceDatabase = (request: Request) => { requireActorSession(request); return getDatabase(); };
