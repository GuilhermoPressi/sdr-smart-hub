/**
 * use-ai-watcher.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Hook que sincroniza agents do backend com o Zustand na inicialização.
 *
 * NOTA: A geração de respostas de IA agora é feita 100% no backend
 * (via webhook da Evolution → OpenAI). Este hook NÃO processa mais
 * mensagens no frontend.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";

export interface AIWatcherStatus {
  active: boolean;
}

export function useAiWatcher(): AIWatcherStatus {
  const { agents, saveAgent } = useApp();
  const syncedRef = useRef(false);

  // ── Sincroniza agents do backend com Zustand ao montar ──────────────────
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    const syncAgents = async () => {
      try {
        const configs = await api.getAiConfigs();
        if (configs && configs.length > 0) {
          configs.forEach((c: any) => saveAgent(c));
          console.log(`[AI-Watcher] ${configs.length} configuração(ões) sincronizada(s) do backend.`);
        }
      } catch (e) {
        console.warn("[AI-Watcher] Não foi possível sincronizar configs do backend:", e);
      }
    };

    syncAgents();
  }, [saveAgent]);

  return {
    active: agents.length > 0,
  };
}
