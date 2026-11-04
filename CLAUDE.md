# Proyecto: Aprender Vercel AI SDK con Ollama

## Contexto
Estoy aprendiendo el Vercel AI SDK construyendo un asistente de chat por fases.
Esta es la **Fase 1: chat básico con streaming**, usando modelos locales de Ollama.
Mi objetivo principal es **entender** cómo funciona el SDK, no solo tener código que funcione.

## Stack técnico
- **Lenguaje:** TypeScript en modo estricto (`strict: true`). Nada de `any` salvo que esté justificado.
- **Framework:** Next.js con App Router.
- **SDK:** AI SDK versión 7 (`ai@^7`) y `@ai-sdk/react@^4` para el frontend.
- **Proveedor:** Ollama local en `http://localhost:11434`.
  - Opción preferida: `@ai-sdk/openai-compatible` apuntando a `http://localhost:11434/v1` (oficial, siempre alineado con la versión del SDK).
  - Alternativa: `ollama-ai-provider-v2`, solo si confirmas que es compatible con la versión 7.
- **Modelo por defecto:** `qwen3:4b` (debe poder cambiarse sin tocar código).
- **Estilos:** Tailwind CSS, diseño simple y limpio.
- **Gestor de paquetes:** npm.

## Alcance de la Fase 1
Incluido:
- Ruta API `app/api/chat/route.ts` que recibe los mensajes y responde en streaming con `streamText`.
- Página de chat con el hook `useChat` que muestra la respuesta token a token.
- Renderizado de mensajes a partir de `message.parts` (no de un campo `content`).
- Botón para detener la generación (`stop`) y estado de carga visible.
- Manejo de errores claro, incluido el caso de que Ollama no esté corriendo o el modelo no esté descargado.
- Un system prompt configurable.
- Configuración por variables de entorno en `.env.local`:
  - `OLLAMA_BASE_URL`
  - `OLLAMA_MODEL`

Fuera de alcance (fases futuras, no implementar todavía):
- Tool calling, salida estructurada, RAG, embeddings, agentes, MCP.
- Persistencia de conversaciones en base de datos.
- Autenticación.

## Estructura esperada
```
app/
  api/chat/route.ts     # Backend: streamText + respuesta en streaming
  page.tsx              # Frontend: interfaz del chat con useChat
  layout.tsx
lib/
  ai.ts                 # Configuración del proveedor y del modelo
.env.local.example      # Variables de entorno de ejemplo
README.md               # Cómo instalar, configurar y ejecutar
```

## Cómo quiero que me ayudes
- **Modo aprendizaje:** avanza paso a paso. Antes de cada bloque de código, explica en pocas frases qué hace y por qué.
- Explica los conceptos clave del SDK cuando aparezcan por primera vez: diferencia entre `UIMessage` y `ModelMessage`, qué hace `convertToModelMessages`, cómo funciona el protocolo de streaming entre servidor y cliente, y qué hace `useChat` por debajo.
- No me entregues todo el proyecto de golpe: propón el siguiente paso y espera mi confirmación.
- Mantén el código mínimo y legible. Evita abstracciones innecesarias y dependencias extra.
- Comenta el código solo donde aporte comprensión, en español.
- Si algo puede fallar en mi entorno local (Ollama apagado, modelo sin descargar, puerto ocupado), dime cómo detectarlo y solucionarlo.

## Reglas importantes sobre la API del SDK
- La API del AI SDK cambia bastante entre versiones mayores y muchos tutoriales usan sintaxis antigua (v3, v4, v5).
- Usa siempre la sintaxis de la **versión 7**. En caso de duda, consulta la documentación oficial: https://ai-sdk.dev/docs (índice para LLMs en https://ai-sdk.dev/llms.txt).
- Si no estás seguro de una firma o de un import, dilo explícitamente en lugar de inventarlo.
- Cuando uses algo que cambió respecto a versiones anteriores, avísame brevemente para que no me confunda con tutoriales viejos.

## Requisitos previos (para el README)
- Node.js 20 o superior.
- Ollama instalado y en ejecución (`ollama serve`).
- Modelo descargado: `ollama pull qwen3:4b`.

## Criterios de "terminado" para la Fase 1
- `npm run dev` levanta la app sin errores ni advertencias de TypeScript.
- Puedo escribir un mensaje y ver la respuesta aparecer en streaming.
- La conversación mantiene el contexto entre mensajes.
- El botón de detener corta la generación.
- Si apago Ollama, la interfaz muestra un error comprensible en lugar de quedarse colgada.
- Cambiar `OLLAMA_MODEL` en `.env.local` cambia el modelo sin modificar código.
