# Checkpoint — Michael 2.0

Resumo do que foi construído nesta rodada e onde paramos.

## ⚠️ Passos manuais pendentes (rodar no Supabase → SQL Editor)
Sem isso, as features novas não funcionam:
1. **`sql/checkin_photos.sql`** — tabela de fotos de check-in + RLS + bucket `checkin-photos` + RPC `get_user_calendar`/`has_diet_photo`. (JÁ RODADO ✅)
2. **`sql/recipes.sql`** — tabela `recipes` + RLS (leitura aluno, escrita admin). **PENDENTE de rodar.**
3. **`sql/seed_test_data.sql`** — (opcional) cria treino + dieta de teste para uma conta. Editar o e-mail no topo.

> Bucket `checkin-photos`: se o SQL não criar via `storage.buckets`, criar manualmente em Storage (público).

## Funcionalidades entregues

### 1. Auditoria social / fotos de check-in (antifraude)
- Câmera in-app real (`CameraCapture`, getUserMedia) — galeria bloqueada de verdade.
- Dieta: foto obrigatória de refeição valida o dia (gate de pontos em `lib/points.ts`).
- Treino: foto pós-cronômetro obrigatória antes do resumo.
- Carimbo de data/hora (`StampedImage`) por overlay; `taken_at` no banco.
- Calendário mensal (`ActivityCalendar`, estilo Whoop): ícones por tipo de treino + thumbnails;
  modal do dia com fotos carimbadas. Acessível **apenas via Ranking** (clicar no nome abre o
  calendário público da pessoa). Rota própria `/app/calendario` existe mas está fora do menu.
- Arquivos: `lib/checkinPhotos.ts`, `components/ui/CameraCapture.*`, `StampedImage.*`,
  `pages/client/ActivityCalendar.*`, `sql/checkin_photos.sql`.

### 2. Modernização visual (design system, ref. Linear)
- `src/index.css`: tokens corrigidos (14 indefinidos viraram aliases), sombras em camadas,
  cinzas limpos, transições, anel de foco, raios menores.
- Gradientes de marca achatados (flat). Componentes base polidos (Button/Card/Input/Select/Modal/
  Checkbox/ProgressBar). Header e heros (Home/Ranking) viraram **claros**; logo ganhou chip escuro.
- Ranking: emoji → ícones (coroa/medalha/troféu), banners dourados → cartões âmbar flat.
- BottomNav: ícones novos (House/BookOpen/LineChart/Salad/Dumbbell/Trophy/CircleUser);
  aba Calendário escondida, **Ranking reativada**.
- Backup pré-mudança em `__ui_backup_*/` (gitignorado).

### 3. Admin — evolução do paciente
- `ClientProfile`: editar **peso inicial, atual, meta e objetivo** num formulário só.
- Badge de evolução agora é **ciente do objetivo** (ganhar com meta de ganhar = "no caminho da
  meta"; direção contrária = "atenção: contra a meta").

### 4. Popup semanal (sexta) com catch-up
- `WeeklyReportModal`: ancora na **sexta mais recente**; se o aluno não abriu na sexta, aparece
  na próxima abertura, 1x por semana. Título adapta fora de sexta.
- Pop-up de notificações: acentos corrigidos.

### 5. Receitas (vídeo YouTube Shorts + macros)
- Admin: `RecipesManager` (aba **Receitas** na Biblioteca) — CRUD: nome, URL do YouTube/Shorts,
  categoria, porção, macros.
- Cliente: Dieta → **Adicionar Refeição** → escolha **Adicionar alimentos** ou **Adicionar receita**.
  Receita abre lista (grid + busca + chips de categoria, lazy-load) → detalhe com **vídeo vertical
  9:16** + macros → "Adicionar ao meu dia" soma como refeição extra (reusa `handleAddExtraMeal`).
- Arquivos: `lib/youtube.ts`, `components/admin/RecipesManager.*`, `components/ui/RecipePicker.*`,
  `YouTubeEmbed` ganhou prop `vertical`. `sql/recipes.sql`.
- Biblioteca admin: abas agora em grade que quebra linha (mobile mostra todas).

## Ofertas em aberto (não feitas, aguardando seu OK)
- Aplicar a lógica **ciente-de-objetivo** também na aba **Progresso do aluno** (hoje só no admin).
- Termo de consentimento LGPD para as fotos públicas do ranking.
- Ícone ativo "preenchido" na BottomNav (estilo premium).
- Framework SSA: instalação foi **bloqueada** pelo guardrail (config/instruções externas). Opções:
  você copiar os arquivos do repo manualmente, autorizar por permissão, ou eu recriar do zero.
- Receita de exemplo via SQL para popular a lista.

## Estado técnico
- `npm run build` passa (cliente + service worker PWA).
- Dev rodando: porta 5173 (com service worker antigo em cache) e **5174** (sem cache — usar esta).
