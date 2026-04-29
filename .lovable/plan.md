
# Plano: LeadFlow SDR — App Visual de IA para WhatsApp

App SaaS apenas visual (sem backend, sem integrações reais) para configurar uma IA SDR no WhatsApp, criar listas de leads, gerenciar contatos e operar um CRM kanban. Todos os dados são fictícios e todas as ações têm feedback visual (loading, toast, modal).

## Direção visual

- **Tema**: escuro premium "Neon Mint", sensação de IA + WhatsApp.
- **Paleta** (HSL no design system):
  - Background base `#0d1b2a` / surface `#11233a` / elevated `#16314f`
  - Primary verde menta `#2dd4a8` (gradiente para `#73ffb8`)
  - Accent violeta `#a78bfa` para indicadores de IA
  - WhatsApp green `#25d366` reservado para badges de canal
  - Texto principal `#e6f4ef`, secundário `#8aa3b8`
- **Tipografia**: Sora (títulos, semibold/bold) + Manrope (corpo). Carregadas via `@fontsource`.
- **Estilo**: glassmorphism sutil (cards com `backdrop-blur` + borda translúcida), gradientes diagonais suaves, sombras profundas com glow verde nos elementos ativos, raio `rounded-2xl` padrão.
- **Animações**: fade-in/slide-up nas trocas de aba, scale nos hovers, shimmer nos skeletons, glow pulsante em status "conectando", transição fluida ao arrastar cards do kanban.

## Arquitetura de navegação

Layout app-shell com:
- **Sidebar fixa** (colapsável em ícone) com logo placeholder "LeadFlow" e 5 itens: Configurar IA, Conectar WhatsApp, Criar Lista, Contatos, CRM.
- **Header superior** com título da página, chip de status global ("Modo demonstração"), badges de conexão (API Oficial / Evolution) e avatar do usuário.
- **Rota raiz** redireciona para Configurar IA. Cada aba é uma rota dedicada.

## Telas

### 1. Configurar IA (`/configurar-ia`)
Formulário em 3 colunas / acordeões agrupados:
- **Identidade da IA**: nome interno, nome de atendimento, empresa, segmento.
- **Oferta**: produto/serviço, público-alvo, problema, benefício.
- **Personalidade**: tom de voz (chips selecionáveis: Profissional, Consultivo, Amigável, Direto, Premium), objetivo da conversa.
- **Qualificação BANT**: 4 cards lado a lado (Budget, Authority, Need, Timeline) com textareas pré-preenchidas com as sugestões do brief.
- **Critérios de qualificação** + **Instruções adicionais**.
- **Card lateral "Resumo da IA"** que atualiza em tempo real montando a frase do prompt SDR descrita no brief, em linguagem amigável.
- Botão primário **"Construir minha IA"** → modal de loading com 5 frases rotativas e barra de progresso animada → tela de sucesso com confete sutil, dois CTAs ("Conectar WhatsApp", "Editar configurações").

### 2. Conectar WhatsApp (`/whatsapp`)
- Subtítulo "Conecte um ou os dois canais. Nada é ativado nesta versão."
- **Dois cards grandes lado a lado**:
  - **API Oficial Meta**: badge "Não conectado", campo de número, lista visual de templates aprovados (3 mockados), botão "Conectar API Oficial".
  - **Evolution API**: badge "Não conectado", quadrado pontilhado central "QR Code será exibido aqui", texto auxiliar, botão "Conectar Evolution".
- Clique em qualquer botão → modal de loading com frases ("Preparando conexão…", "Gerando ambiente seguro…", "Aguardando QR Code…") → estado final visual "QR Code aguardando integração" + toast.

### 3. Criar Lista (`/criar-lista`)
- **Seleção de fonte**: dois cards grandes — LinkedIn (ativo, com glow), Google Maps (desabilitado com badge "Em breve").
- **Bloco de busca LinkedIn**: campos (busca, cargo, localização, segmento) + grupo de chips para quantidade (50/100/250/500).
- **Card pontilhado "Configuração APIfy"** reservado para integração futura.
- Botão **"Buscar leads"** → loading com 5 frases → tabela mockada com 3 leads do brief (Mariana, Rafael, Camila) com telefones no padrão `+55 DDD número`.
- Ações finais: **"Criar esses contatos"** (loading + toast "Contatos criados…") e **"Excluir contatos"**.

### 4. Contatos (`/contatos`)
- Barra superior: busca, filtros (origem, tag, status), botão "Novo contato".
- Tabela moderna com checkbox de seleção e colunas: Nome, Telefone, Email, Origem, Tags, CRM, Etapa, Status (badges coloridos).
- **Painel lateral de ações em massa** desliza ao selecionar 1+ contatos:
  - Criar/adicionar tag
  - Adicionar campos personalizados (nome + valor)
  - Adicionar ao CRM (dropdown)
  - Escolher pipeline (dropdown)
  - Escolher etapa (aparece após o pipeline; 8 etapas do brief)
  - Botão **"Aplicar"** → loading com 4 frases → toast "Ações aplicadas aos contatos selecionados".

### 5. CRM (`/crm`)
- Kanban horizontal com scroll, **8 colunas** exatamente como no brief, cada uma com header colorido por temperatura/etapa, contador de cards e descrição curta.
- **Cards de lead** com: nome, telefone (+55), origem, tags, última interação, status IA, badge de temperatura (Frio/Morno/Quente com cor).
- **Drag & drop visual** entre colunas (usando `@dnd-kit`), com animação fluida.
- **Cards de automação** dentro de colunas-chave:
  - "Foi abordado": card "Automação da etapa" com select de template aprovado (3 opções mockadas).
  - "Respondeu abordagem": card "Atendimento IA via Evolution" mostrando duas mensagens mockadas (handoff oficial → IA não oficial), em estilo bolha de chat.
  - "Aguardando proposta": destaque visual "Ação manual do vendedor".
- Toasts contextuais ao mover leads: "Template oficial programado para envio", "Atendimento com IA preparado via Evolution", "Lead qualificado. Ação manual do vendedor necessária".

## Componentes reutilizáveis

Sidebar, Header, PremiumCard (glass), GradientButton com 5 estados, LoadingModal (frases rotativas + progress), SuccessModal, Toaster (sonner), SkeletonRow/SkeletonCard, EmptyState ilustrado, DataTable com seleção, KanbanBoard + KanbanCard, StatusBadge (Novo, Conectado, Não conectado, Em breve, Qualificado, Aguardando proposta), AutomationChip (API Oficial, Evolution API, IA SDR, Meta Template).

## Detalhes técnicos

- Estado global em memória (Zustand ou Context) compartilhando: config da IA, status de conexões, lista de contatos mockados, posições no kanban — assim ações em uma aba refletem em outra durante a demo.
- Drag-and-drop com `@dnd-kit/core` + `@dnd-kit/sortable`.
- Tipografia via `@fontsource/sora` e `@fontsource/manrope`, importadas em `main.tsx` e mapeadas em `tailwind.config.ts` (`font-display` Sora, `font-sans` Manrope).
- Design system completo em `index.css` (HSL tokens) e tokens semânticos no Tailwind (background, surface, surface-elevated, primary, primary-glow, accent, whatsapp, muted, border-subtle).
- Toasts via `sonner` (já presente).
- Telefones formatados por util `formatPhoneBR` para garantir o padrão `+55 11 98765-4321`.
- Nenhuma chamada de rede, nenhum Supabase, nenhuma autenticação. Tudo client-side.

## Critérios de aceite

- Navegação fluida entre as 5 abas, layout responsivo a partir de tablet.
- Construção da IA mostra modal de loading com frases e tela de sucesso.
- Ambos os cards de WhatsApp simulam conexão com QR placeholder.
- Busca de leads gera tabela mockada com telefones no padrão Meta.
- Seleção de contatos abre painel de ações em massa funcional visualmente.
- Kanban com 8 colunas, drag-and-drop funcional, automações visíveis nas etapas certas, toasts corretos.
- Visual coeso "Neon Mint" escuro, Sora + Manrope aplicadas em todo o app.
