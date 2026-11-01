import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDatabase, type AppDatabase } from "@/src/server/database";
import { AppError } from "@/src/server/http";

export const PUBLIC_SESSION_TTL = 8 * 60 * 60;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const tables = (db: AppDatabase) => db.exec(`
 CREATE TABLE IF NOT EXISTS public_sessions (token_hash TEXT PRIMARY KEY, actor_id TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS public_sessions_expiry ON public_sessions(expires_at);
 CREATE TABLE IF NOT EXISTS public_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS public_work (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL);
`);
const clientKey = (request: Request) => digest(request.headers.get("x-forwarded-for")?.split(",").map(v=>v.trim()).filter(Boolean).at(-1) || "unknown-client");
function limit(db: AppDatabase, key: string, count: number, windowMs: number, now: number) {
 const start = Math.floor(now/windowMs)*windowMs;
 const bucket = `${key}:${start}`;
 const row = db.prepare("SELECT hits FROM public_limits WHERE bucket = ?").get(bucket) as {hits:number}|undefined;
 if ((row?.hits || 0) >= count) throw new AppError("public_rate_limit", "Public AI is busy. Please wait a minute before trying again.", 429);
 db.prepare("INSERT INTO public_limits VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1").run(bucket,start+windowMs);
}
export function issuePublicSession(request: Request, db = getDatabase(), now = Date.now()) {
 tables(db);
 return db.transaction(()=>{
  const expired = db.prepare("SELECT actor_id FROM public_sessions WHERE expires_at <= ?").all(now) as {actor_id:string}[];
  for(const row of expired) {db.prepare("DELETE FROM ai_tasks WHERE owner_id = ?").run(row.actor_id);db.prepare("DELETE FROM service_connections WHERE owner_id = ?").run(row.actor_id);}
  db.prepare("DELETE FROM public_sessions WHERE expires_at <= ?").run(now);
  db.prepare("DELETE FROM public_limits WHERE expires_at <= ?").run(now);
  limit(db,`sessions:${clientKey(request)}`,40,3600000,now);
  limit(db,"sessions:global",1000,3600000,now);
  const active = db.prepare("SELECT COUNT(*) AS n FROM public_sessions").get() as {n:number};
  if(active.n>=2000)throw new AppError("public_capacity","Public AI is busy. Please try again shortly.",429);
  const value=`visitor_${randomBytes(32).toString("base64url")}`;
  const actorId=`public:${randomUUID()}`;const expiresAt=now+PUBLIC_SESSION_TTL*1000;
  db.prepare("INSERT INTO public_sessions VALUES (?, ?, ?)").run(digest(value),actorId,expiresAt);
  return {value,actorId,expiresAt,maxAge:PUBLIC_SESSION_TTL};
 })();
}
export function readPublicSession(token: string, db = getDatabase(), now = Date.now()) {
 tables(db);
 const row=db.prepare("SELECT actor_id, expires_at FROM public_sessions WHERE token_hash = ? AND expires_at > ?").get(digest(token),now) as {actor_id:string;expires_at:number}|undefined;
 if(!row)throw new AppError("public_session_expired","Your public workspace expired. Refresh the page to continue.",401);
 return {actorId:row.actor_id,authType:"public" as const,expiresAt:row.expires_at};
}
export function revokePublicSession(token: string, db = getDatabase()) {
 tables(db);
 const row=db.prepare("SELECT actor_id FROM public_sessions WHERE token_hash = ?").get(digest(token)) as {actor_id:string}|undefined;
 if(!row)return;
 db.transaction(()=>{db.prepare("DELETE FROM ai_tasks WHERE owner_id = ?").run(row.actor_id);db.prepare("DELETE FROM service_connections WHERE owner_id = ?").run(row.actor_id);db.prepare("DELETE FROM public_sessions WHERE token_hash = ?").run(digest(token));})();
}
// Persistent budgets and expiring concurrency leases apply before every guest provider call.
export function beginPublicWork(request: Request, session: {authType:string;actorId:string}, db = getDatabase(), now = Date.now()) {
 if(session.authType!=="public")return ()=>{};
 tables(db);const id=randomUUID();
 db.transaction(()=>{
  db.prepare("DELETE FROM public_work WHERE expires_at <= ?").run(now);
  db.prepare("DELETE FROM public_limits WHERE expires_at <= ?").run(now);
  limit(db,`ai:visitor:${session.actorId}`,10,60000,now);limit(db,`ai:visitor-hour:${session.actorId}`,60,3600000,now);
  limit(db,`ai:client:${clientKey(request)}`,40,60000,now);limit(db,`ai:client-hour:${clientKey(request)}`,240,3600000,now);
  limit(db,"ai:global-hour",240,3600000,now);limit(db,"ai:global-day",1000,86400000,now);
  const active=db.prepare("SELECT COUNT(*) AS n FROM public_work").get() as {n:number};
  if(active.n>=8||db.prepare("SELECT id FROM public_work WHERE actor_id = ?").get(session.actorId))throw new AppError("public_busy","A public AI request is already running. Please try again shortly.",429);
  db.prepare("INSERT INTO public_work VALUES (?, ?, ?)").run(id,session.actorId,now+180000);
 })();
 return ()=>{db.prepare("DELETE FROM public_work WHERE id = ?").run(id);};
}
export async function publicJson(request: Request) {
 const reader=request.body?.getReader();if(!reader)throw new AppError("invalid_request","A JSON request is required.",400);
 const chunks:Uint8Array[]=[];let size=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000)throw new AppError("request_too_large","Keep your request under 2,000 characters.",413);chunks.push(value);}}
 finally {await reader.cancel();}
 try{const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("object required");return body;}catch{throw new AppError("invalid_request","Send a valid JSON request.",400);}
}
