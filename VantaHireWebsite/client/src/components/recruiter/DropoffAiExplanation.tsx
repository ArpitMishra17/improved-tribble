import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { callLLM } from "@/lib/ai/llmClient";

type DropoffStep = {
  name: string;
  rate: number;
  count: number;
};

interface DropoffAiExplanationProps {
  dropoff: DropoffStep[];
  fallback: string;
}

export function DropoffAiExplanation({ dropoff, fallback }: DropoffAiExplanationProps) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const payload = dropoff.map((d) => ({ name: d.name, count: d.count, conversion: d.rate }));
      const prompt = `You are helping a recruiter interpret conversion data across hiring stages. Here is a JSON array of stages with candidate counts and conversion rates from the previous stage:\n\n${JSON.stringify(
        payload,
        null,
        2
      )}\n\nWrite 1–2 short sentences describing where the biggest bottleneck is and a plausible operational reason. Do NOT invent numbers; base everything on the JSON data.`;
      try {
        const res = await callLLM(prompt);
        if (!cancelled) setText(res);
      } catch (err) {
        console.warn("AI dropoff explanation failed", err);
        if (!cancelled) setText("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (dropoff.length) run();
    return () => {
      cancelled = true;
    };
  }, [dropoff]);

  if (!dropoff.length) return null;

  return (
    <div className="text-xs text-slate-700 space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          AI-assisted
        </Badge>
        <span className="text-slate-500">{loading ? "Analyzing drop-offs…" : "AI interpretation"}</span>
      </div>
      <p className="text-slate-800">
        {text || fallback}
      </p>
    </div>
  );
}
