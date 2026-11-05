import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { MODEL_ID, model } from "@/lib/ai";

// Una herramienta = descripción + esquema de entrada + función execute.
// El modelo solo ve la descripción y el esquema; execute corre en TU servidor.
const getHora = tool({
  description:
    "Devuelve la fecha y hora actual en una zona horaria. Úsala siempre que el usuario pregunte la hora.",
  // En v7 se llama `inputSchema` (en v3/v4 era `parameters`).
  inputSchema: z.object({
    zonaHoraria: z
      .string()
      .describe("Zona horaria IANA, por ejemplo 'America/Lima' o 'Europe/Madrid'"),
  }),
  execute: async ({ zonaHoraria }) => {
    try {
      const hora = new Intl.DateTimeFormat("es-PE", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: zonaHoraria,
      }).format(new Date());
      return { zonaHoraria, hora };
    } catch {
      // Zona inválida: se devuelve como resultado para que el modelo se corrija.
      return { error: `Zona horaria no válida: ${zonaHoraria}` };
    }
  },
});

// Instrucciones que el modelo recibe al inicio de cada petición.
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ??
  "Eres un asistente útil. Responde en español, de forma clara y concisa.";

export async function POST(req: Request) {
  // El cliente (useChat) envía el historial como UIMessage[].
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model,
    // En v7 se usa `instructions`; `system` sigue existiendo pero está deprecado.
    instructions: SYSTEM_PROMPT,
    // UIMessage (lo que ve la UI) -> ModelMessage (lo que entiende el modelo).
    // Es async en v7, hay que usar await.
    messages: await convertToModelMessages(messages),
    tools: { getHora },
    // Por defecto el SDK se detiene tras 1 paso: el modelo pediría la herramienta
    // y nadie redactaría la respuesta final. Permitimos hasta 5 pasos.
    // (En v7 el nombre real es isStepCount; stepCountIs es su alias.)
    stopWhen: stepCountIs(5),
  });

  // Respuesta en el protocolo de streaming de UIMessage, que useChat sabe leer.
  return result.toUIMessageStreamResponse({
    // Por defecto el SDK oculta el error real ("An error occurred.").
    // Aquí lo traducimos a un mensaje útil que useChat expondrá en `error`.
    onError: (error) => {
      console.error("[/api/chat]", error);
      const text = error instanceof Error ? error.message : String(error);

      if (/fetch failed|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|Cannot connect/i.test(text)) {
        return "No se pudo conectar con Ollama. Comprueba que está encendido y que OLLAMA_BASE_URL es correcta.";
      }
      if (/not found/i.test(text)) {
        return `El modelo "${MODEL_ID}" no está descargado en Ollama. Ejecuta: ollama pull ${MODEL_ID}`;
      }
      return `Error del modelo: ${text}`;
    },
  });
}
