# Chat con Vercel AI SDK + Ollama

Fase 1 de un asistente de chat para aprender el [Vercel AI SDK](https://ai-sdk.dev/docs): chat básico con streaming usando modelos locales de Ollama.

## Stack

- Next.js (App Router) + TypeScript estricto + Tailwind CSS
- `ai@^7` y `@ai-sdk/react@^4`
- `@ai-sdk/openai-compatible` apuntando a la API `/v1` de Ollama

## Requisitos previos

- Node.js 20 o superior
- Ollama instalado y en ejecución (`ollama serve`), local o en otra máquina de la red
- Modelo descargado en esa instancia: `ollama pull qwen3:4b` (o el que configures)

## Instalación

```bash
npm install
cp .env.local.example .env.local
```

## Configuración

Edita `.env.local`:

| Variable          | Descripción                                                          | Ejemplo                        |
| ----------------- | -------------------------------------------------------------------- | ------------------------------ |
| `OLLAMA_BASE_URL` | URL de Ollama **terminada en `/v1`** (API compatible con OpenAI)     | `http://localhost:11434/v1`    |
| `OLLAMA_MODEL`    | Modelo a usar; se cambia sin tocar código                            | `qwen3:4b`                     |
| `SYSTEM_PROMPT`   | (Opcional) instrucciones iniciales del modelo                        | `Responde en español.`         |

Next solo lee `.env.local` al arrancar: reinicia `npm run dev` tras cambiarlo.

Si Ollama corre en otra máquina, debe escuchar en la red (`OLLAMA_HOST=0.0.0.0`) y el firewall debe permitir el puerto 11434. Es preferible usar el nombre de host en lugar de la IP si esta cambia por DHCP.

## Ejecución

```bash
npm run dev
```

Abre http://localhost:3000.

## Estructura

```
app/
  api/chat/route.ts   # Backend: streamText + respuesta en streaming
  page.tsx            # Frontend: interfaz del chat con useChat
  layout.tsx
lib/
  ai.ts               # Proveedor y modelo (lee las variables de entorno)
.env.local.example    # Plantilla de variables de entorno
```

## Cómo funciona

1. `useChat` guarda los mensajes como `UIMessage[]` y envía el historial completo con `POST /api/chat`.
2. La ruta convierte los `UIMessage` a `ModelMessage` con `convertToModelMessages` (async en v7) y llama a `streamText`.
3. `toUIMessageStreamResponse()` devuelve el resultado como eventos SSE que `useChat` va ensamblando token a token.
4. La página pinta `message.parts` (`text` y `reasoning`). `stop()` aborta la generación.

## Solución de problemas

| Síntoma                                         | Causa probable / solución                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| "No se pudo conectar con Ollama"                | Ollama apagado, URL incorrecta, firewall o `OLLAMA_HOST`. Prueba `curl <host>:11434/api/tags`.                     |
| "El modelo … no está descargado"                | Ejecuta `ollama pull <modelo>` en la máquina de Ollama.                                                           |
| Puerto 3000 ocupado                             | `npm run dev -- -p 3001`                                                                                          |
| Cambié `.env.local` y no pasa nada              | Reinicia `npm run dev`.                                                                                           |
| Error de tipos `LayoutProps` no encontrado      | Ejecuta `npx next typegen`.                                                                                       |

## Fuera de alcance (fases futuras)

Tool calling, salida estructurada, RAG, embeddings, agentes, MCP, persistencia de conversaciones y autenticación.
