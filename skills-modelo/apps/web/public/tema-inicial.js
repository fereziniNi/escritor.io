// Aplica o tema antes da primeira pintura (sem piscar). Carregado por <script src="/tema-inicial.js"></script> no <head>
// do index.html (arquivo externo: funciona com CSP sem 'unsafe-inline'). Mesma chave de src/tema/tema.ts.
/* eslint-disable no-undef */
try {
  var salvo = localStorage.getItem('multiplica:tema');
  var escuro = salvo === 'escuro' || (salvo !== 'claro' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
} catch {
  /* sem armazenamento: o CSS segue o sistema */
}
