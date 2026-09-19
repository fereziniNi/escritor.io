import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { queryClient } from './app/queryClient.ts'
import './index.css'
import './styles/paineis.css'
// Auditoria de segurança (VULN-07, MEDIUM): o CSP novo do Nginx (`script-src 'self'`, sem
// `unsafe-eval`) quebrava por completo o mapa do escritório - o Pixi.js usa `new Function()`
// internamente pra gerar código de sincronização de shader/UBO otimizado em runtime, e o
// navegador bloqueava isso ("pageerror: Current environment does not allow unsafe-eval").
// Confirmado ao vivo com Playwright antes desta correção. `pixi.js/unsafe-eval` é o módulo
// oficial do próprio Pixi pra exatamente este caso (ambientes com CSP restrito) - troca os
// caminhos rápidos baseados em `eval` por polyfills equivalentes, sem exigir `unsafe-eval` no
// CSP. Precisa ser importado uma vez só, antes de qualquer uso do Pixi (ele altera protótipos
// globalmente) - aqui, no bootstrap da aplicação, é o mais cedo possível.
import 'pixi.js/unsafe-eval'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
