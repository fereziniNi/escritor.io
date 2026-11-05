# Configuração do esqueleto (arquivos JSON e afins)

Os arquivos abaixo não podem ir para `referencia/` como cópia (JSON não aceita a linha de comentário `origem:`).
Cada bloco é o conteúdo **exato** do arquivo no projeto-modelo (conferido automaticamente com ele): crie o arquivo
com o caminho indicado e cole o bloco. Troque só o que estiver explicado no texto (nome do sistema, versão).

Os arquivos `.ts`, `.tsx`, `.mjs`, `.yml` etc. estão em `referencia/` no mesmo caminho relativo; ao copiá-los,
**apague a 1ª linha** (`// origem: ...`, `# origem: ...`, `<!-- origem: ... -->`, `/* origem: ... */`).

## Raiz do monorepo

`package.json` raiz. `dev` sobe API e web juntas; `test` roda os testes de todos os pacotes. A seção
`pnpm.onlyBuiltDependencies` libera só os pacotes que precisam de script de instalação (os demais não rodam
nada no `pnpm install`). Os scripts `verificar-referencias` e o `node --test "scripts/*.test.mjs"` do `test` são
do projeto-modelo do escritor.io: num sistema novo, **remova** o script `verificar-referencias` e use
`"test": "pnpm -r test"`.

<!-- arquivo: skills-modelo/package.json -->
```json
{
  "name": "skills-modelo",
  "version": "0.1.0",
  "private": true,
  "description": "Projeto-modelo Multiplica: prova que o código de referência das skills oficiais compila e passa nos testes.",
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=22.22"
  },
  "scripts": {
    "dev": "pnpm --parallel --filter api --filter web dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test && node --test \"scripts/*.test.mjs\"",
    "verificar-referencias": "node scripts/verificar-referencias.mjs"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "@swc/core",
      "esbuild",
      "@tailwindcss/oxide"
    ]
  }
}
```

`tsconfig.base.json` (herdado por todos os pacotes):

<!-- arquivo: skills-modelo/tsconfig.base.json -->
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "isolatedModules": true
  }
}
```

`.gitignore`:

<!-- arquivo: skills-modelo/.gitignore -->
```gitignore
# Gerados e locais: nunca versionar.
node_modules/
dist/
coverage/
test-results/
playwright-report/
*.tsbuildinfo
.env
```

## apps/api

`apps/api/package.json`. `db:generate` gera a migração a partir de `src/banco/esquema.ts`; `db:migrate` aplica.

<!-- arquivo: skills-modelo/estagios/novo-projeto-multiplica/apps/api/package.json -->
```json
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/banco/executar-migracoes.ts"
  },
  "dependencies": {
    "@nestjs/common": "11.2.8",
    "@nestjs/core": "11.2.8",
    "@nestjs/platform-express": "11.2.8",
    "contratos": "workspace:*",
    "drizzle-orm": "0.45.4",
    "express": "5.3.0",
    "nestjs-pino": "5.3.1",
    "pg": "8.23.1",
    "pino": "10.4.0",
    "pino-http": "11.0.0",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.2",
    "zod": "4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@nestjs/cli": "11.0.24",
    "@nestjs/testing": "11.2.8",
    "@swc/core": "1.16.22",
    "@testcontainers/postgresql": "12.2.1",
    "@types/express": "5.0.6",
    "@types/node": "22.20.5",
    "@types/pg": "8.23.1",
    "@types/supertest": "7.2.1",
    "drizzle-kit": "0.31.11",
    "eslint": "10.14.0",
    "supertest": "7.3.1",
    "tsx": "4.23.15",
    "typescript": "6.0.3",
    "typescript-eslint": "8.72.1",
    "unplugin-swc": "2.0.0",
    "vitest": "5.1.0"
  }
}
```

`apps/api/tsconfig.json` — `experimentalDecorators` e `emitDecoratorMetadata` são obrigatórios (injeção de
dependência do Nest); `module`/`moduleResolution` `nodenext` com o pacote em CommonJS (sem `"type": "module"`).

<!-- arquivo: skills-modelo/apps/api/tsconfig.json -->
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "rootDir": ".",
    "outDir": "dist",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noPropertyAccessFromIndexSignature": true,
    "types": ["node"]
  },
  "include": ["src", "test", "vitest.config.mts", "drizzle.config.ts"]
}
```

`apps/api/tsconfig.build.json` (o build gera `dist/main.js` e `dist/banco/executar-migracoes.js`):

<!-- arquivo: skills-modelo/apps/api/tsconfig.build.json -->
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`apps/api/nest-cli.json` (usado pelo `pnpm dev`):

<!-- arquivo: skills-modelo/apps/api/nest-cli.json -->
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "sourceRoot": "src",
  "compilerOptions": { "tsConfigPath": "tsconfig.build.json", "deleteOutDir": true }
}
```

`apps/api/drizzle/meta/_journal.json` — diário vazio de migrações (o `db:generate` acrescenta as entradas):

<!-- arquivo: skills-modelo/estagios/novo-projeto-multiplica/apps/api/drizzle/meta/_journal.json -->
```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": []
}
```

## apps/web

`apps/web/package.json` (`"type": "module"`; `e2e` roda o Playwright contra o build):

<!-- arquivo: skills-modelo/apps/web/package.json -->
```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@fontsource/inter": "5.3.0",
    "@fontsource/jetbrains-mono": "5.3.0",
    "@fontsource/space-grotesk": "5.3.0",
    "@radix-ui/react-slot": "1.5.0",
    "@tanstack/react-query": "5.106.1",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "contratos": "workspace:*",
    "lucide-react": "1.69.0",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "react-router": "8.5.1",
    "tailwind-merge": "3.7.0"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.64.1",
    "@tailwindcss/vite": "4.3.4",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.8",
    "@types/node": "22.20.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.2.1",
    "eslint": "10.14.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.7",
    "globals": "17.14.0",
    "jsdom": "31.0.0",
    "tailwindcss": "4.3.4",
    "tw-animate-css": "1.4.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.72.1",
    "vite": "8.3.6",
    "vitest": "5.1.0"
  }
}
```

`apps/web/tsconfig.json`:

<!-- arquivo: skills-modelo/apps/web/tsconfig.json -->
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["vite/client", "node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "e2e", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

`apps/web/components.json` (shadcn/ui; aliases em português):

<!-- arquivo: skills-modelo/apps/web/components.json -->
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/componentes",
    "utils": "@/lib/utils",
    "ui": "@/componentes/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

## packages/contratos

`packages/contratos/package.json` — ESM; `exports` aponta para o código-fonte em desenvolvimento e nos tipos e
para `dist/` no build (a API, em CommonJS, carrega o `dist/` com `require` de ESM, suportado no Node 22.12+).

<!-- arquivo: skills-modelo/packages/contratos/package.json -->
```json
{
  "name": "contratos",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "zod": "4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@types/node": "22.20.5",
    "eslint": "10.14.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.72.1",
    "vitest": "5.1.0"
  }
}
```

`packages/contratos/tsconfig.json` e `tsconfig.build.json`:

<!-- arquivo: skills-modelo/packages/contratos/tsconfig.json -->
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src"]
}
```

<!-- arquivo: skills-modelo/packages/contratos/tsconfig.build.json -->
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": false
  },
  "include": ["src"],
  "exclude": ["src/**/*.spec.ts"]
}
```

## Fora de `referencia/` (gerados por ferramenta)

- `pnpm-lock.yaml`: gerado pelo `pnpm install`; versione-o.
- `apps/web/src/componentes/ui/*`: gerados por `pnpm dlx shadcn@latest add <componente>` dentro de `apps/web`.
