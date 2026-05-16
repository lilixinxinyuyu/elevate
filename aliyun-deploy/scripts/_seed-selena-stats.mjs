import OSS from "ali-oss";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars","utf-8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]})
);
const c = new OSS({endpoint:`https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,bucket:env.ALIYUN_OSS_BUCKET,accessKeyId:env.ALIYUN_OSS_ACCESS_KEY_ID,accessKeySecret:env.ALIYUN_OSS_ACCESS_KEY_SECRET,secure:true});
// Read Selena snapshot directly + compute stats locally (Node has memory)
const got = await c.get("users/selena/snapshot.json");
const text = got.content.toString("utf-8");
const payload = JSON.parse(text);
const tables = payload.data ?? payload;
const t = (n) => Array.isArray(tables[n]) ? tables[n] : [];
const attempts = t("attempts");
const mistakes = t("mistakes");
const trophies = t("trophies");
const sessions = t("sessions");
const mastery = t("mastery");
const fluencyAttempts = t("fluencyAttempts");
const tutorSessions = t("tutorSessions");
const today = new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
const todayAttempts = attempts.filter(a => a.createdAt && new Date(a.createdAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) === today).length;
const SEVEN_AGO = Date.now() - 7*86400_000;
const last7 = attempts.filter(a => (a.createdAt ?? 0) >= SEVEN_AGO).length;
const bySubject = {};
for (const a of attempts) {
  const s = a.subject ?? a.subjectId ?? "math";
  bySubject[s] = (bySubject[s] ?? 0) + 1;
}
const skillCounts = {};
for (const m of mistakes) {
  if (m.resolved) continue;
  const sk = m.skillId ?? "?";
  skillCounts[sk] = (skillCounts[sk] ?? 0) + 1;
}
const topMistakeSkills = Object.entries(skillCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([skillId,count])=>({skillId,count}));
const lastTs = attempts.reduce((m,a)=>Math.max(m,a.createdAt??0),0);
const recent100 = attempts.slice(-100);
const correct = recent100.filter(a=>a.isCorrect).length;
const correctRate = recent100.length > 0 ? correct/recent100.length : 0;
const stats = {
  counts: { attempts: attempts.length, mistakes: mistakes.length, trophies: trophies.length, sessions: sessions.length, mastery: mastery.length, fluencyAttempts: fluencyAttempts.length, tutorSessions: tutorSessions.length },
  today: { attempts: todayAttempts, sessions: 0 },
  last7Days: { attempts: last7 },
  bySubject,
  topMistakeSkills,
  correctRateRecent100: Math.round(correctRate*100),
  lastActivityMs: lastTs,
  snapshotBytes: text.length,
  fetchedAt: Date.now(),
};
await c.put("users/selena/stats.json", Buffer.from(JSON.stringify(stats)), {headers:{"Content-Type":"application/json; charset=utf-8"}});
console.log("Seeded selena stats:", JSON.stringify(stats.counts), "lastActivity:", new Date(lastTs).toISOString());
