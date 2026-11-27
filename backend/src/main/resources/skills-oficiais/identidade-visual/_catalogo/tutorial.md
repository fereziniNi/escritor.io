# Tutorial — Identidade visual

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **identidade-visual**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/identidade-visual/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill, trocando `<NOME>` pelo nome curto do sistema.

## Parte específica desta skill

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skill `novo-projeto-multiplica` já aplicada (existe `apps/web`) | `ls apps/web` ou `dir apps\web` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Internet na instalação | só para baixar os pacotes de fonte (depois o sistema não precisa de internet) | `pnpm install` termina sem erro |

### Variáveis de ambiente

Esta skill não usa variáveis de ambiente. A única "configuração" é a escolha de tema de cada pessoa, guardada no
navegador (`multiplica:tema`).

| Nome | Obrigatória | Exemplo |
|---|---|---|
| (nenhuma) | não | — |

### Dependências npm

Instaladas com versão fixa: `@fontsource/inter`, `@fontsource/space-grotesk`, `@fontsource/jetbrains-mono` (5.3.0).
Já usadas pelo esqueleto: `tailwindcss` 4, `tw-animate-css`, `lucide-react`, `react-router`. O botão do shadcn
(`pnpm dlx shadcn@latest add button`, dentro de `apps/web`) é gerado pela ferramenta.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro.
3. Procure cores soltas (deve listar só o arquivo `tokens.css`):
   - bash / Git Bash / macOS / Linux: `grep -rnE "#[0-9a-fA-F]{6}\b" apps/web/src --include=*.tsx --include=*.css`
   - PowerShell: `Get-ChildItem apps\web\src -Recurse -Include *.tsx,*.css | Select-String -Pattern "#[0-9a-fA-F]{6}\b"`
4. Suba o sistema (`pnpm dev`) e abra http://localhost:5173. Confira: sidebar azul-marinho de 256px à esquerda, marca
   "Beyond…" com o nome em ciano, o item da página atual em azul com uma barra ciano à esquerda.
5. Clique no ícone de lua/sol no rodapé da sidebar: a tela inteira muda para o modo escuro. Recarregue a página (F5):
   deve continuar escura, sem piscar branco.
6. Abra o DevTools (F12) → Aplicativo/Application → Armazenamento local: existe a chave `multiplica:tema`.
7. Aba Rede/Network (recarregue): as fontes vêm do próprio endereço do sistema, nenhuma de `fonts.googleapis.com`.

Próximo passo: seguir a ordem de skills indicada pelo Claude Code (a próxima é `seguranca`).
