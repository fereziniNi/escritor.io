---
name: identidade-visual
description: Use quando for criar ou ajustar a aparência de um sistema Multiplica - cores, tema claro/escuro, fontes, sidebar, layout de página, cartões, tabelas, formulários, telas de login, listagem e painel, estados vazio/carregando/erro, ou formatação de moeda, data, CPF e CNPJ. Use também quando o pedido for "padronizar o visual", "aplicar a identidade da Multiplica" ou "fazer igual aos outros sistemas", e quando outra skill Multiplica precisar da tela ou do componente padrão.
---

# Identidade visual Multiplica

Uma única identidade para todo sistema novo da Multiplica: paleta azul com navy de marca e ciano de destaque, modo
escuro, Inter + Space Grotesk + JetBrains Mono (auto-hospedadas), sidebar navy de 256px e quatro telas-modelo. O
código em `referencia/` é cópia de um projeto-modelo que compila e passa nos testes: copie e adapte, não reescreva
de memória. Vem da união de BeyondCredit, BeyondComitê, FinAnalytics e Conta Gráfica.

## Padrão Multiplica

1. **Nunca cor solta, sempre token.** Nenhum `#hex`, `rgb()`, `oklch()` nem classe de paleta do Tailwind
   (`bg-blue-500`, `text-gray-600`) fora de `src/tema/tokens.css`. Use utilitários dos tokens (`bg-primaria`,
   `text-texto-2`, `border-borda`) ou `var(--token)`. Verificação: `grep -rnE "#[0-9a-fA-F]{3,8}\b|(bg|text|border)-(blue|gray|slate|red|green)-" apps/web/src --include=*.tsx --include=*.css` só pode achar `tokens.css`.
2. **Tokens claros** em `:root` (arquivo `src/tema/tokens.css`):

   | Token | Claro | Escuro | Uso |
   |---|---|---|---|
   | `--primaria` | `#2F6FED` | `#5B8DEF` | botão principal, link, item ativo |
   | `--primaria-hover` | `#1F5AD6` | `#7BA3F3` | hover da primária |
   | `--primaria-suave` | `#EAF1FE` | `#16264A` | fundo de destaque leve |
   | `--navy` | `#001A33` | `#000E1C` | sidebar |
   | `--navy-hover` | `#0D2B46` | `#0A1E33` | hover na sidebar |
   | `--navy-texto` | `#C2CEDD` | `#9FB0C5` | texto na sidebar |
   | `--ciano` | `#00E1FF` | `#00E1FF` | destaque (barra do item ativo, nome na marca) |
   | `--fundo` | `#F5F7FA` | `#0B1120` | fundo da página |
   | `--superficie` | `#FFFFFF` | `#111A2E` | cartões, tabelas, campos |
   | `--borda` | `#DEE6EF` | `#1F2A40` | bordas e divisores |
   | `--texto` / `--texto-2` / `--texto-3` | `#172B43` / `#5B6B80` / `#8A97A8` | `#E6ECF5` / `#A3B1C6` / `#6B7A90` | texto principal, secundário, apoio |
   | `--sucesso` (+ `-suave`) | `#059669` (`#E6F6F0`) | `#34D399` (`#0D2A22`) | positivo |
   | `--alerta` (+ `-suave`) | `#D97706` (`#FEF3E2`) | `#FBBF24` (`#2B2210`) | atenção |
   | `--perigo` (+ `-suave`) | `#DC2626` (`#FDECEC`) | `#F87171` (`#2E1414`) | erro, exclusão |
   | `--info` (+ `-suave`) | `#0284C7` (`#E6F3FA`) | `#38BDF8` (`#0C2433`) | informativo |

   `--sobre-primaria` (`#FFFFFF`) é o texto sobre a primária.
3. **Modo escuro** com os mesmos nomes: valores da tabela em `:root[data-theme="dark"]` (escolha da pessoa) **e**
   repetidos em `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` (sistema escuro sem
   escolha). Os dois blocos têm de ficar idênticos.
4. **Tema sem piscar**: `public/tema-inicial.js` (arquivo externo, sem script inline, serve com CSP) é carregado no
   `<head>` antes do CSS e grava `data-theme` na raiz a partir da chave `multiplica:tema` (`claro` | `escuro`) ou do
   sistema. `src/tema/tema.ts` (`aplicarTema`, `alternarTema`, `temaEfetivo`) usa a mesma chave. Nunca outra chave.
5. **shadcn derivado dos tokens**: `--primary`, `--background`, `--foreground`, `--card`, `--muted`, `--accent`,
   `--destructive`, `--border`, `--input`, `--ring` e `--sidebar-*` apontam para os tokens (`--primary: var(--primaria)`)
   em `tokens.css`. Componentes do shadcn funcionam sem edição e acompanham o tema.
6. **Fontes**: Inter (texto), Space Grotesk (títulos `h1`-`h3` e números grandes, classe `font-display`), JetBrains Mono
   (valores, datas em tabela, versão; classe `font-mono`), todas por `@fontsource/*` (auto-hospedadas, nada de Google
   Fonts, CDN ou `<link>` externo). Pesos: Inter 400/500/600/700, Space Grotesk 500/600/700, JetBrains Mono 400/500.
7. **Escala tipográfica** 12 / 13 / 14 / 16 / 20 / 24 / 30 px: `text-xs` 12 (rótulo, legenda), `text-13` 13 (tabela
   densa, menu), `text-sm` 14 (**corpo/base**), `text-base` 16 (destaque), `text-xl` 20 (cabeçalho de tela),
   `text-2xl` 24 (número grande de indicador, título de seção), `text-3xl` 30 (título de destaque). Sem tamanhos fora da escala.
8. **Raios** 6 / 8 / 12 px: `rounded-sm` 6 (selos pequenos, barras), `rounded-md` 8 (botões, campos, itens de menu),
   `rounded-lg` 12 (**cartões** e tabelas). Selos de status usam `rounded-full`.
9. **Tailwind v4 CSS-first**: o mapeamento dos tokens para utilitários (`--color-primaria: var(--primaria)`, fontes,
   escala, raios) fica em `@theme inline` no `src/index.css`. Não existe `tailwind.config.ts` no esqueleto (v4); para
   projeto antigo em Tailwind v3, veja `referencia/tailwind-v3.md`.
10. **AppShell** (`componentes/AppShell.tsx`): sidebar navy de 256px (`w-64`), marca `Beyond<span ciano>Nome</span>` +
    "MULTIPLICA" embaixo, grupos de menu com título em caixa alta, **item ativo** em `bg-primaria` com
    `box-shadow: inset 3px 0 0 var(--ciano)` e `aria-current="page"` (vem do `NavLink`), rodapé com usuário, papel e
    `v{versao}` (a versão vem de `/api/health`) e o botão de tema.
11. **Blocos de página**: toda tela logada usa `CabecalhoPagina` (h1 + descrição + ações); agrupamento em `Cartao`;
    status em `Selo` (tons `sucesso`, `alerta`, `perigo`, `info`); campos com `Campo` (rótulo acima, erro abaixo,
    `aria-invalid`); gráfico simples com `GraficoBarras` (para gráficos ricos, use recharts com as mesmas cores via `var(--token)`).
12. **Três estados obrigatórios** em toda consulta: `Carregando` (`role="status"`), `ErroCarregar` (`role="alert"`
    com "Tentar de novo") e `EstadoVazio` (explica e oferece a ação). Nunca tela em branco nem erro só no console.
13. **Formatos BR só por `lib/formatos.ts`**: `formatarMoeda(1250000)` → `R$ 1.250.000,00`; `formatarData("2026-11-05")` →
    `05/11/2026` (data pura não muda de dia por fuso; instante é mostrado no horário de Brasília); `formatarCpf("12345678909")`
    → `123.456.789-09`; `formatarCnpj("11222333000181")` → `11.222.333/0001-81`. Documento e valor guardados sem
    máscara (só dígitos / número); a máscara é só da tela. Valores monetários e datas em tabela usam `font-mono tabular-nums`.
14. **Telas-modelo** (`telas/modelo/`): `TelaLogin` (cartão centralizado), `TelaListagem` (filtros acima + tabela
    densa + vazio), `TelaFormulario` (validação com mensagem por campo), `TelaPainel` (indicadores + gráfico). São
    ponto de partida: copie a que se parece com a tela pedida, troque os dados de exemplo por `useQuery`.
15. **Acessibilidade mínima**: foco visível em tudo que clica, contraste dos tokens preservado (não use `texto-3` para
    texto essencial), todo campo com `label`, gráfico com `aria-label` descrevendo os dados, ícone sem texto com `aria-label`.

## Como aplicar

Pré-requisito: o esqueleto da skill `novo-projeto-multiplica` (`apps/web` com Tailwind 4, shadcn e react-router) já
existe e `pnpm --filter web test` passa. Ao copiar um arquivo de `referencia/`, mantenha o mesmo caminho relativo e
**apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. Dependências: o `apps/web/package.json` do esqueleto já traz `@fontsource/inter`, `@fontsource/space-grotesk` e
   `@fontsource/jetbrains-mono` (5.3.0). Se não trouxer: `pnpm --filter web add -E @fontsource/inter@5.3.0
   @fontsource/space-grotesk@5.3.0 @fontsource/jetbrains-mono@5.3.0`. Botão do shadcn, se faltar: `pnpm dlx shadcn@latest add button` dentro de `apps/web`.
2. TDD: copie **primeiro** os testes — `src/lib/formatos.test.ts`, `src/tema/tema.test.ts`,
   `src/componentes/AppShell.test.tsx`, `src/componentes/componentes.test.tsx`, `src/telas/modelo/telas-modelo.test.tsx`
   — e rode `pnpm --filter web test`: tem de falhar (módulos inexistentes).
3. Copie o código: `src/lib/formatos.ts`, `src/tema/tokens.css`, `src/tema/tema.ts`, `public/tema-inicial.js`,
   `src/componentes/*.tsx`, `src/telas/modelo/*.tsx`. Rode de novo: passa.
4. **Substitua `src/index.css`** pelo `referencia/apps/web/src/index.css` (ele importa fontes, Tailwind, `tw-animate-css`
   e `./tema/tokens.css`, e traz o `@theme inline`). `src/main.tsx` continua importando `./index.css`.
5. Em `apps/web/index.html`, no `<head>` e **antes** de qualquer CSS, acrescente `<script src="/tema-inicial.js"></script>`.
6. Troque o nome: nas telas-modelo e no `AppShell`, `nomeSistema` é o nome curto do sistema (ex.: "Crédito" → marca
   "BeyondCrédito"). Ajuste o título do `index.html`.
7. Use o `AppShell` no roteador (`src/App.tsx`): rotas logadas dentro de um layout, a de login fora.

   ```tsx
   const grupos = [{ titulo: 'Operação', itens: [{ rotulo: 'Painel', para: '/' }] }];
   function Layout() {
     const saude = useQuery({ queryKey: ['saude'], queryFn: buscarSaude });
     return (
       <AppShell nomeSistema="Crédito" grupos={grupos} usuario={{ nome: 'Ana Souza' }} versao={saude.data?.versao}>
         <Outlet />
       </AppShell>
     );
   }
   const roteador = createBrowserRouter([
     { path: '/entrar', element: <TelaLogin nomeSistema="Crédito" aoEntrar={entrar} /> },
     { element: <Layout />, children: [{ path: '/', element: <TelaPainel /> }] },
   ]);
   ```
8. Verifique: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; `pnpm dev`, abra http://localhost:5173, alterne o
   tema no rodapé da sidebar, recarregue (deve manter, sem piscar) e confira no DevTools que `localStorage["multiplica:tema"]` existe.

**Projeto existente fora do esqueleto** (outro framework de CSS, sem Tailwind 4, sem shadcn): não reescreva as telas.
Aplique o que independe de stack: copie `tokens.css` e `tema-inicial.js`; use os tokens em vez de cores soltas nas
telas que você tocar; Tailwind v3, siga `referencia/tailwind-v3.md`; sem Tailwind, use `var(--token)` no CSS
existente e as fontes `@fontsource`. Adote `lib/formatos.ts` e o `AppShell` como especificação (sidebar de 256px,
item ativo com barra ciano) na tecnologia do projeto, e registre no `CLAUDE.md` onde ficou cada coisa.

**Para o usuário final, ao terminar:** acrescente `identidade-visual` em "Skills Multiplica aplicadas" do `CLAUDE.md`.

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou no esqueleto da skill `novo-projeto-multiplica`
(`src/lib/utils.ts` com `cn`, `src/lib/api.ts`, `vitest.config.ts`, `src/teste-setup.ts`, `tailwindcss`, `tw-animate-css`,
`lucide-react`, `react-router`) e em `src/componentes/ui/button.tsx`, que o shadcn gera (`pnpm dlx shadcn@latest add button`).

- `referencia/apps/web/src/tema/tokens.css` — todas as cores, claro e escuro, e a ligação com as variáveis do shadcn; passo 3, e ao criar ou mudar uma cor.
- `referencia/apps/web/src/index.css` — entrada do CSS (fontes, `@theme inline`, escala, raios, base); substitui o do esqueleto, passo 4.
- `referencia/apps/web/src/tema/tema.ts`, `public/tema-inicial.js` — troca de tema e aplicação antes da pintura; ao mexer no tema.
- `referencia/apps/web/src/lib/formatos.ts` — moeda, data, CPF, CNPJ; sempre que mostrar valor ou documento.
- `referencia/apps/web/src/componentes/AppShell.tsx`, `AlternarTema.tsx` — sidebar, marca, menu, rodapé; passo 7.
- `referencia/apps/web/src/componentes/CabecalhoPagina.tsx`, `Cartao.tsx`, `Selo.tsx`, `Campo.tsx`, `GraficoBarras.tsx` — blocos de página.
- `referencia/apps/web/src/componentes/estados.tsx` — `EstadoVazio`, `Carregando`, `ErroCarregar`; em toda consulta.
- `referencia/apps/web/src/telas/modelo/TelaLogin.tsx`, `TelaListagem.tsx`, `TelaFormulario.tsx`, `TelaPainel.tsx` — telas de partida.
- `referencia/apps/web/src/**/*.test.ts(x)` — testes de tokens, tema, formatos, shell, blocos e telas; passo 2 (antes do código).
- `referencia/tailwind-v3.md` — mesmo mapeamento em `tailwind.config.ts` para projetos antigos em Tailwind v3.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem limpos.
- [ ] `grep` da regra 1 não acha cor solta fora de `tokens.css`.
- [ ] `tokens.css` tem `--primaria: #2F6FED`, `--navy: #001A33`, `--ciano: #00E1FF`, o bloco escuro e o `@media (prefers-color-scheme: dark)` iguais.
- [ ] Alternar o tema grava `multiplica:tema`, troca `data-theme` e, ao recarregar, a tela já abre no tema escolhido (sem piscar).
- [ ] Sidebar de 256px, marca "Beyond+Nome" + MULTIPLICA, item da página atual com barra ciano e `aria-current="page"`, versão no rodapé.
- [ ] Nenhuma fonte vem de Google Fonts ou CDN (aba Rede do navegador só mostra arquivos do próprio sistema).
- [ ] Toda lista ou consulta tem os três estados (carregando, erro, vazio).
- [ ] Moeda, data, CPF e CNPJ saem de `lib/formatos.ts`; nada guardado com máscara.
- [ ] Telas conferidas nos dois temas e em largura de notebook (1280px).
- [ ] `identidade-visual` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
