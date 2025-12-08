/**
 * Client-side helper to call the server AI proxy.
 * Falls back to a simple message on failure.
 */
export async function callLLM(prompt: string): Promise<string> {
  try {
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      throw new Error(`AI request failed (${res.status})`);
    }
    const data = await res.json();
    return typeof data.text === "string" && data.text.length ? data.text : "AI insight unavailable right now.";
  } catch (err) {
    console.warn("callLLM failed:", err);
    return "AI insight unavailable right now.";
  }
}
