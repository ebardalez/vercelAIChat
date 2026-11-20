import { tool, type InferUITools, type UIMessage } from "ai";
import { z } from "zod";

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

export const tools = { getHora, buscarCiudad, getClima };

// Tipo del mensaje de chat: un UIMessage cuyos tool parts conocen la entrada y la
// salida reales de cada herramienta (InferUITools las deduce de `tools`).
// Los dos `never` son los tipos de metadatos y de data parts, que no usamos.
// El cliente lo importa con `import type`, así que no arrastra código de servidor.
export type ChatMessage = UIMessage<never, never, InferUITools<typeof tools>>;
