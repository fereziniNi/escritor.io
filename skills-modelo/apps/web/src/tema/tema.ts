/** Tema claro/escuro: segue o sistema até a pessoa escolher; a escolha fica salva neste navegador. */
export type Tema = 'claro' | 'escuro';

/** Mesma chave de public/tema-inicial.js. */
export const CHAVE_TEMA = 'multiplica:tema';

export function temaSalvo(): Tema | null {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return v === 'claro' || v === 'escuro' ? v : null;
  } catch {
    return null;
  }
}

/** O tema que está valendo: a escolha salva ou, sem escolha, a preferência do sistema. */
export function temaEfetivo(): Tema {
  const salvo = temaSalvo();
  if (salvo) return salvo;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

/** Aplica o tema na raiz (data-theme) e grava a escolha. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset['theme'] = tema === 'escuro' ? 'dark' : 'light';
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    /* armazenamento indisponível: vale só nesta visita */
  }
}

/** Troca claro <-> escuro e devolve o novo tema. */
export function alternarTema(): Tema {
  const novo: Tema = temaEfetivo() === 'escuro' ? 'claro' : 'escuro';
  aplicarTema(novo);
  return novo;
}
