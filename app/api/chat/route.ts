import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { MODEL_ID, model } from "@/lib/ai";

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
