import { NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `You are the assistant behind Jeffrey Wong's retro ASCII terminal portfolio.
Answer in a concise, terminal-friendly way (short lines, monospace-friendly; use line breaks when helpful).
You may mention projects: CourtVision (basketball / CV), Polymolt (games), BeaverTrails (trails).
If the user asks how to navigate, suggest typing 'help' for a list of local commands.`;

export async function POST(req: Request) {
  const key = process.env.CHAT_API_KEY ?? process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Server missing API key. Add CHAT_API_KEY to .env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  let body: { message?: string; history?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const prior = Array.isArray(body.history) ? body.history : [];
  const history: ChatMessage[] = prior
    .filter(
      (m): m is ChatMessage =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-12);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: message },
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1024,
      temperature: 0.65,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json(
      { error: `Upstream error (${res.status}): ${errText.slice(0, 500)}` },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply =
    data.choices?.[0]?.message?.content?.trim() || "No response from model.";
  return NextResponse.json({ reply });
}
