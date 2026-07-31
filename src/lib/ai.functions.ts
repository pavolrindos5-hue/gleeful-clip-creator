import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ChatInput = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "ai"]),
      text: z.string(),
    }),
  ),
  context: z.string().optional(),
});

const SYSTEM = `Si AI asistent zabudovaný do video editora (rozhranie je v slovenčine).
Odpovedáš vždy po slovensky, priateľsky, stručne (max 3 vety).
Podľa toho, čo používateľ chce, vyber JEDNU akciu, ktorú editor vykoná, alebo null keď ide len o rozhovor.
Povolené akcie (presné reťazce):
captions (pridať titulky), enhance (vylepšiť kvalitu), denoise (odstrániť šum),
stabilize (stabilizácia), colorgrade (farebná korekcia), transition (prechod medzi klipmi),
speedup (zrýchliť), slowdown (spomaliť), cut (strihnúť na pozícii playhead),
music (otvoriť pridanie hudby), intro (pridať intro), outro (pridať outro),
reset (vrátiť do pôvodného stavu), seek (skok na začiatok), addmedia (pridať fotku/video).
V odpovedi napíš, čo si urobil.`;

export const chatWithEditorAI = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });
    const model = gateway("openai/gpt-5.6-sol");

    const messages = [
      { role: "system" as const, content: SYSTEM + (data.context ? `\n\nStav projektu: ${data.context}` : "") },
      ...data.messages.map((m) => ({
        role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      })),
    ];

    try {
      const { output } = await generateText({
        model,
        messages,
        output: Output.object({
          schema: z.object({
            reply: z.string(),
            action: z.string().nullable(),
          }),
        }),
        providerOptions: { lovable: { reasoningEffort: "none" } },
      });
      return { reply: output.reply, action: output.action ?? undefined };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const text = (error.text ?? "").trim();
        if (text) return { reply: text, action: undefined };
      }
      throw error;
    }
  });
