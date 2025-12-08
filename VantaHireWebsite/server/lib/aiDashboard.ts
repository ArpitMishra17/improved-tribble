import { createHash } from "crypto";
import { redisGet, redisSet } from "./redis";
import Groq from "groq-sdk";
import { isAIEnabled } from "../aiJobAnalyzer";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key not configured");
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey: GROQ_API_KEY });
  }
  return groqClient;
}

export interface DashboardAiPayload {
  pipelineHealthScore: { score: number; tag: string };
  timeRangeLabel: string;
  applicationsOverTime: Array<{ date: string; value: number }>;
  stageDistribution: Array<{ name: string; count: number }>;
  dropoff: Array<{ name: string; rate: number; count: number }>;
  timeInStage: Array<{ stageName: string; averageDays: number }>;
  jobsNeedingAttention: Array<{
    jobId: number;
    title: string;
    severity: "high" | "medium" | "low";
    reason: string;
  }>;
}

export interface DashboardAiInsights {
  summary: string;
  dropoffExplanation: string;
  jobs: Array<{ jobId: number; nextAction: string }>;
  generatedAt: string;
}

const TTL_SECONDS = 60 * 60 * 24; // 24 hours

function cacheKey(userId: number, payload: DashboardAiPayload) {
  const hash = createHash("sha1")
    .update(JSON.stringify({ timeRangeLabel: payload.timeRangeLabel, jobs: payload.jobsNeedingAttention.map(j => j.jobId) }))
    .digest("hex");
  return `ai:dashboard:${userId}:${hash}`;
}

export async function getDashboardAiInsights(userId: number, payload: DashboardAiPayload): Promise<DashboardAiInsights> {
  if (!isAIEnabled()) {
    throw new Error("AI not enabled");
  }
  const key = cacheKey(userId, payload);
  const cached = await redisGet(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const jobList = payload.jobsNeedingAttention.map(j => `- jobId ${j.jobId}: "${j.title}" (${j.severity}) - ${j.reason}`).join("\n");

  const prompt = `You are helping a recruiter interpret their hiring pipeline. Use ONLY the provided data. Respond with valid JSON only, no markdown.

Data:
- Pipeline health: ${payload.pipelineHealthScore.score}% (${payload.pipelineHealthScore.tag})
- Time range: ${payload.timeRangeLabel}
- Drop-off stages: ${payload.dropoff.map(d => `${d.name}: ${d.rate}%`).join(", ")}
- Time in stage: ${payload.timeInStage.map(t => `${t.stageName}: ${t.averageDays}d`).join(", ")}
- Jobs needing attention:
${jobList}

Return JSON with this exact structure:
{
  "summary": "1-2 sentence pipeline summary",
  "dropoffExplanation": "1-2 sentence drop-off explanation (biggest bottleneck)",
  "jobs": [{"jobId": <number>, "nextAction": "short action max 18 words"}]
}`;

  const client = getGroq();
  const resp = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are a concise assistant for recruiter dashboards. Respond with valid JSON only. Do not invent numbers." },
      { role: "user", content: prompt },
    ],
    max_tokens: 600,
    temperature: 0.3,
  });
  const text = resp.choices[0]?.message?.content?.trim() || "";

  // Parse JSON response
  let summary = "AI summary unavailable.";
  let dropoffExplanation = "AI drop-off explanation unavailable.";
  let jobs: Array<{ jobId: number; nextAction: string }> = payload.jobsNeedingAttention.map(j => ({ jobId: j.jobId, nextAction: "" }));

  try {
    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```json\s*|```$/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed.summary) summary = parsed.summary;
    if (parsed.dropoffExplanation) dropoffExplanation = parsed.dropoffExplanation;
    if (Array.isArray(parsed.jobs)) {
      jobs = payload.jobsNeedingAttention.map(j => {
        const found = parsed.jobs.find((pj: any) => pj.jobId === j.jobId);
        return { jobId: j.jobId, nextAction: found?.nextAction || "" };
      });
    }
  } catch (e) {
    console.warn("[AI dashboard] Failed to parse JSON response:", e, text);
  }

  const result: DashboardAiInsights = {
    summary: summary || "AI summary unavailable.",
    dropoffExplanation: dropoffExplanation || "AI drop-off explanation unavailable.",
    jobs,
    generatedAt: new Date().toISOString(),
  };

  await redisSet(key, JSON.stringify(result), TTL_SECONDS);
  return result;
}
