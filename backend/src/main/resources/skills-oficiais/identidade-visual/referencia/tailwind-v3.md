# Tailwind v3: o mesmo mapeamento em `tailwind.config.ts`

Só para projetos antigos em Tailwind v3. No esqueleto (Tailwind v4) **não existe** `tailwind.config.ts`: o mapeamento
fica em `@theme inline` dentro de `src/index.css`. Este arquivo é documento, não é conferido com o projeto-modelo.

1. Copie `apps/web/src/tema/tokens.css` (os tokens são CSS puro e valem nas duas versões) e importe-o no CSS de
   entrada: `@import "./tema/tokens.css";` antes das diretivas `@tailwind`.
2. Mantenha `public/tema-inicial.js` e `src/tema/tema.ts` como estão.
3. Use `darkMode: ['selector', '[data-theme="dark"]']` (Tailwind 3.4.1+) e mapeie os tokens:

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primaria: { DEFAULT: 'var(--primaria)', hover: 'var(--primaria-hover)', suave: 'var(--primaria-suave)' },
        'sobre-primaria': 'var(--sobre-primaria)',
        navy: { DEFAULT: 'var(--navy)', hover: 'var(--navy-hover)', texto: 'var(--navy-texto)' },
        ciano: 'var(--ciano)',
        fundo: 'var(--fundo)',
        superficie: 'var(--superficie)',
        borda: 'var(--borda)',
        texto: { DEFAULT: 'var(--texto)', 2: 'var(--texto-2)', 3: 'var(--texto-3)' },
        sucesso: { DEFAULT: 'var(--sucesso)', suave: 'var(--sucesso-suave)' },
        alerta: { DEFAULT: 'var(--alerta)', suave: 'var(--alerta-suave)' },
        perigo: { DEFAULT: 'var(--perigo)', suave: 'var(--perigo-suave)' },
        info: { DEFAULT: 'var(--info)', suave: 'var(--info-suave)' },
        // nomes do shadcn/ui
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: 'var(--destructive)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // escala 12 / 13 / 14 (base) / 16 / 20 / 24 / 30
      fontSize: {
        xs: '12px',
        13: '13px',
        sm: '14px',
        base: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
      },
      // raios 6 / 8 / 12
      borderRadius: { sm: '6px', md: '8px', lg: '12px', xl: '12px' },
    },
  },
} satisfies Config;
```

4. As fontes continuam por `@fontsource/*` (importe os CSS de cada peso no `main.tsx`). No Tailwind v3 o `components.json`
   do shadcn aponta `"config": "tailwind.config.ts"` e `"css"` para o CSS de entrada.
5. Confira com `npx tailwindcss -i src/index.css -o /tmp/saida.css` que `bg-primaria`, `text-texto-2` e `text-13` aparecem no resultado.
