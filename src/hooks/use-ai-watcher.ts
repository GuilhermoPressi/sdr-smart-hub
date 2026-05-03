/**
 * use-ai-watcher.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Hook que:
 *  - Sincroniza agents do backend com o Zustand na inicialização
 *  - Faz polling das conversas a cada N segundos
 *  - Para cada conversa com IA ativa, verifica se há nova mensagem do lead
 *  - Aciona o ai-responder para gerar e enviar a resposta
 *  - Mantém um Set de mensagens já processadas para não duplicar respostas
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import {
  processAndRespond,
  shouldAiRespond,
  lastMessageIsFromLead,
  getLogs,
  AILog,
} from "@/lib/ai-responder";

const POLL_INTERVAL_MS = 6000;
const INSTANCE_NAME = "Gpressi";

const processedLastMsg = new Map<string, string>();
const processing = new Set<string>();

export interface AIWatcherStatus {
  active: boolean;
  logsRef: React.MutableRefObject<AILog[]>;
}

export function useAiWatcher(): AIWatcherStatus {
  const { agents, saveAgent } = useApp();
  const logsRef = useRef<AILog[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Pega a IA ativa — prioriza a que tem active=true, senão usa a primeira
  const getActiveAiConfig = useCallback(() => {
    if (agents.length === 0) return null;
    return agents.find((a: any) => a.active) || agents[0];
  }, [agents]);

  const runCycle = useCallback(async () => {
    const aiConfig = getActiveAiConfig();
    if (!aiConfig) return;

    logsRef.current = getLogs();

    let conversations: any[];
    try {
      conversations = await api.getConversations();
    } catch {
      return;
    }

    for (const conv of conversations) {
      if (!shouldAiRespond(conv)) continue;
      if (processing.has(conv.id)) continue;

      let messages: any[];
      try {
        messages = await api.getMessages(conv.id);
      } catch {
        continue;
      }

      if (!lastMessageIsFromLead(messages)) continue;

      const lastMsg = messages[messages.length - 1];
      const lastMsgId = lastMsg?.id;

      if (lastMsgId && processedLastMsg.get(conv.id) === lastMsgId) continue;

      processing.add(conv.id);

      try {
        await processAndRespond({
          conversation: conv,
          messages,
          aiConfig,
          instanceName: INSTANCE_NAME,
        });

        if (lastMsgId) processedLastMsg.set(conv.id, lastMsgId);
      } catch {
        // Erro já logado dentro de processAndRespond
      } finally {
        processing.delete(conv.id);
        logsRef.current = getLogs();
      }
    }
  }, [getActiveAiConfig]);

  useEffect(() => {
    if (agents.length > 0) {
      runCycle();
      timerRef.current = setInterval(runCycle, POLL_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [agents, runCycle]);

  return {
    active: agents.length > 0,
    logsRef,
  };
}
