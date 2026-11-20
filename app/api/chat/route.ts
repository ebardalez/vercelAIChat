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

// Herramienta 1 de la cadena: convierte un nombre de ciudad en coordenadas.
// El modelo no conoce lat/lon con fiabilidad, así que debe preguntarlas aquí.
const buscarCiudad = tool({
  description:
    "Busca una ciudad por nombre y devuelve su nombre, país, latitud y longitud. Úsala antes de getClima para obtener las coordenadas.",
  inputSchema: z.object({
    nombre: z.string().describe("Nombre de la ciudad, por ejemplo 'Lima' o 'Madrid'"),
  }),
  execute: async ({ nombre }) => {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nombre)}&count=1&language=es`;
      const res = await fetch(url);
      if (!res.ok) return { error: `El servicio de geocodificación respondió ${res.status}` };
      const data: {
        results?: { name: string; country: string; latitude: number; longitude: number }[];
      } = await res.json();
      const ciudad = data.results?.[0];
      if (!ciudad) return { error: `No se encontró la ciudad: ${nombre}` };
      return {
        nombre: ciudad.name,
        pais: ciudad.country,
        latitud: ciudad.latitude,
        longitud: ciudad.longitude,
      };
    } catch {
      return { error: "No se pudo contactar con el servicio de geocodificación" };
    }
  },
});

// Códigos WMO que devuelve Open-Meteo -> texto. Si falta alguno, se devuelve el número.
const CODIGOS_TIEMPO: Record<number, string> = {
  0: "despejado",
  1: "mayormente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "niebla",
  51: "llovizna",
  61: "lluvia",
  71: "nieve",
  80: "chubascos",
  95: "tormenta",
};

// Herramienta 2: usa las coordenadas que salieron de buscarCiudad (su salida
// es la entrada de esta, y por eso hacen falta varios pasos).
const getClima = tool({
  description:
    "Devuelve el clima actual (temperatura, humedad, viento y estado del cielo) en unas coordenadas. Necesita latitud y longitud: obtenlas con buscarCiudad.",
  inputSchema: z.object({
    latitud: z.number().describe("Latitud en grados decimales"),
    longitud: z.number().describe("Longitud en grados decimales"),
  }),
  execute: async ({ latitud, longitud }) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitud}&longitude=${longitud}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
      const res = await fetch(url);
      if (!res.ok) return { error: `El servicio de clima respondió ${res.status}` };
      const { current }: {
        current: {
          temperature_2m: number;
          relative_humidity_2m: number;
          wind_speed_10m: number;
          weather_code: number;
        };
      } = await res.json();
      return {
        temperaturaC: current.temperature_2m,
        humedadPct: current.relative_humidity_2m,
        vientoKmh: current.wind_speed_10m,
        cielo: CODIGOS_TIEMPO[current.weather_code] ?? `código ${current.weather_code}`,
      };
    } catch {
      return { error: "No se pudo contactar con el servicio de clima" };
    }
  },
});

// Instrucciones que el modelo recibe al inicio de cada petición.
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ??
  "Eres un asistente útil. Responde en español, de forma clara y concisa. " +
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
    tools: { getHora, buscarCiudad, getClima },
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
