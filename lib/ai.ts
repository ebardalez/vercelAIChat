import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Ollama expone una API compatible con OpenAI en /v1, así que usamos
// el proveedor genérico "openai-compatible" apuntando a esa URL.
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  // Ollama no exige API key; no hace falta enviarla.
});

// El nombre del modelo viene del entorno: se cambia en .env.local sin tocar código.
export const MODEL_ID = process.env.OLLAMA_MODEL ?? "qwen3:4b";

// chatModel() devuelve un LanguageModel que streamText() sabe usar.
export const model = ollama.chatModel(MODEL_ID);
