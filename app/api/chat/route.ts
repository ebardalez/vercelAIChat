import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { MODEL_ID, model } from "@/lib/ai";
import { tools } from "@/lib/tools";

// Instrucciones que el modelo recibe al inicio de cada petición.
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ??
  "Eres un asistente útil. Responde siempre en el mismo idioma en que escribe el usuario en su último mensaje " +
    "(inglés si escribe en inglés, francés si escribe en francés, etc.), de forma clara y concisa. " +
    "Escribe en texto plano: no uses Markdown (nada de **negritas**, # títulos ni listas con símbolos). " +
    "Nunca inventes datos de clima ni de hora: si el usuario los pide, debes obtenerlos con las herramientas " +
    "(buscarCiudad y getClima para el clima, getHora para la hora). Si piden varias cosas, llama a todas las herramientas necesarias.";

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
    tools,
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
