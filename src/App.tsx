import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import ConfigurarIA from "./pages/ConfigurarIA";
import ConectarWhatsapp from "./pages/ConectarWhatsapp";
import CriarLista from "./pages/CriarLista";
import Contatos from "./pages/Contatos";
import CRM from "./pages/CRM";
import Conversas from "./pages/Conversas";
import NotFound from "./pages/NotFound.tsx";
import { useAiWatcher } from "@/hooks/use-ai-watcher";
import LogsIA from "./pages/LogsIA";
import Disparos from "./pages/Disparos";

const queryClient = new QueryClient();

/** Ativa o watcher de IA globalmente dentro do contexto do app */
function AiWatcherProvider({ children }: { children: React.ReactNode }) {
  useAiWatcher();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AiWatcherProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/configurar-ia" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/configurar-ia" element={<ConfigurarIA />} />
              <Route path="/whatsapp" element={<ConectarWhatsapp />} />
              <Route path="/criar-lista" element={<CriarLista />} />
              <Route path="/contatos" element={<Contatos />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/conversas" element={<Conversas />} />
              <Route path="/disparos" element={<Disparos />} />
              <Route path="/logs-ia" element={<LogsIA />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AiWatcherProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
