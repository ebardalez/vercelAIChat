import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Registro de capacidades del harness. Se guarda en un JSON local que el servidor
// lee en cada petición y que la interfaz de gestión edita (pasos siguientes).
// Este módulo usa `fs`, así que solo debe importarse desde código de servidor
// (rutas API); el cliente puede importar los TIPOS con `import type`.

// Un servidor MCP remoto: el SDK se conecta por HTTP y expone sus tools al modelo.
export const McpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url(),
  // Apagarlo no lo borra: simplemente no se conecta ni aporta tools.
  enabled: z.boolean().default(true),
});

// Una skill = instrucciones reutilizables en Markdown. El modelo ve solo
// name + description y carga `content` cuando lo necesita (tool cargarSkill).
export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  content: z.string(),
  enabled: z.boolean().default(true),
});

export const HarnessSchema = z.object({
  mcpServers: z.array(McpServerSchema).default([]),
  skills: z.array(SkillSchema).default([]),
});

export type McpServer = z.infer<typeof McpServerSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Harness = z.infer<typeof HarnessSchema>;

// Ruta configurable para poder probar sin tocar el archivo real.
const FILE = process.env.HARNESS_FILE ?? path.join(process.cwd(), "data", "harness.json");

export async function readHarness(): Promise<Harness> {
  let raw: string;
  try {
    raw = await fs.readFile(FILE, "utf8");
  } catch (e) {
    // Primera ejecución: aún no hay archivo, se parte de un registro vacío.
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return HarnessSchema.parse({});
    throw e;
  }
  // Si el JSON está corrupto o no cumple el esquema, falla con un error claro
  // en vez de seguir con datos a medias.
  return HarnessSchema.parse(JSON.parse(raw));
}

export async function writeHarness(harness: Harness): Promise<void> {
  const data = HarnessSchema.parse(harness);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  // Escritura atómica: se escribe un temporal y se renombra. Así un corte a mitad
  // de escritura no deja el JSON truncado.
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}
