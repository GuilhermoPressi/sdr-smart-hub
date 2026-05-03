/**
 * use-ai-watcher.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Hook que:
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

const POLL_INTERVAL_MS = 6000; // 6 segundos
const INSTANCE_NAME = "Gpressi";

// IDs das últimas mensagens já processadas por conversa { conversationId → lastMessageId }
const processedLastMsg = new Map<string, string>();
// Conversas atualmente sendo processadas (evita concorrência)
const processing = new Set<string>();

export interface AIWatcherStatus {
  active: boolean;
  logsRef: React.MutableRefObject<AILog[]>;
}

export function useAiWatcher(): AIWatcherStatus {
  const { agents } = useApp();
  const logsRef = useRef<AILog[]>([]);
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pega a IA ativa (primeiro agent marcado como ativo no backend, ou o primeiro da lista)
  const getActiveAiConfig = useCallback(() => {
    if (agents.length === 0) return null;
    return agents[0]; // O backend controla qual está ativo; usamos o primeiro disponível
  }, [agents]);

  const runCycle = useCallback(async () => {
    const aiConfig = getActiveAiConfig();
    if (!aiConfig) return;

    // Atualiza referência de logs
    logsRef.current = getLogs();

    let conversations: any[];
    try {
      conversations = await api.getConversations();
    } catch {
      return; // Silencioso — retry no próximo ciclo
    }

    for (const conv of conversations) {
      // Verificar se esta conversa precisa de resposta IA
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

      // Já processamos esta mensagem?
      if (lastMsgId && processedLastMsg.get(conv.id) === lastMsgId) continue;

      // Marcar como em processamento
      processing.add(conv.id);

      try {
        await processAndRespond({
          conversation: conv,
          messages,
          aiConfig,
          instanceName: INSTANCE_NAME,
        });

        // Marcar mensagem como processada
        if (lastMsgId) processedLastMsg.set(conv.id, lastMsgId);
      } catch {
        // Erro já logado dentro de processAndRespond
      } finally {
        processing.delete(conv.id);
        // Atualiza logs após cada processamento
        logsRef.current = getLogs();
      }
    }
  }, [getActiveAiConfig]);

  useEffect(() => {
    activeRef.current = agents.length > 0;

    if (agents.length > 0) {
      // Rodar imediatamente e depois em intervalo
      runCycle();
      timerRef.current = setInterval(runCycle, POLL_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      activeRef.current = false;
    };
  }, [agents, runCycle]);

  return {
    active: agents.length > 0,
    logsRef,
  };
}
