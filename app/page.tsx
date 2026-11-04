"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export default function Chat() {
  // useChat guarda los mensajes (UIMessage[]) y hace POST a /api/chat por defecto.
  const { messages, sendMessage, status, stop, error, regenerate } = useChat();
  const [input, setInput] = useState("");

  // "submitted": petición enviada, aún sin tokens. "streaming": llegando tokens.
  const isLoading = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4">
      <h1 className="mb-4 text-xl font-semibold">Chat con Ollama</h1>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-blue-600 px-4 py-2 text-white"
                : "max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 dark:bg-zinc-800"
            }
          >
            {/* Un mensaje es una lista de parts; cada part tiene un type. */}
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p key={i} className="whitespace-pre-wrap">
                    {part.text}
                  </p>
                );
              }
              if (part.type === "reasoning") {
                // qwen3 "piensa" antes de responder; lo dejamos plegado.
                return (
                  <details key={i} className="mb-2 text-sm text-zinc-500">
                    <summary className="cursor-pointer">Razonamiento</summary>
                    <p className="whitespace-pre-wrap">{part.text}</p>
                  </details>
                );
              }
              return null;
            })}
          </div>
        ))}

        {status === "submitted" && (
          <p className="text-sm text-zinc-500">Pensando…</p>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p>{error.message}</p>
            <button
              onClick={() => regenerate()}
              className="mt-2 underline"
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje…"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-lg bg-red-600 px-4 py-2 text-white"
          >
            Detener
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Enviar
          </button>
        )}
      </form>
    </main>
  );
}
