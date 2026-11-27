// origem: skills-modelo/apps/web/src/lib/formatos.ts
// Formatos brasileiros. Dinheiro, data e documentos sempre passam por aqui, nunca formatados à mão na tela.

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBrasilia = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

/** 1250000 -> "R$ 1.250.000,00" (espaço comum no lugar do espaço sem quebra do Intl). */
export function formatarMoeda(valor: number): string {
  return moeda.format(valor).replace(/\s/g, ' ');
}

/**
 * "2026-11-05" -> "05/11/2026" (data pura, sem mudar de dia por fuso). Instantes (Date ou texto com horário) são
 * mostrados no horário de Brasília. Vazio ou inválido -> "—".
 */
export function formatarData(valor: Date | string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'string') {
    const pura = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (pura) return `${pura[3]}/${pura[2]}/${pura[1]}`;
  }
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? '—' : dataBrasilia.format(data);
}

const soDigitos = (texto: string) => texto.replace(/\D/g, '');

/** "12345678909" -> "123.456.789-09". Se não tiver 11 dígitos devolve o texto como veio. */
export function formatarCpf(valor: string): string {
  const d = soDigitos(valor);
  if (d.length !== 11) return valor;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "11222333000181" -> "11.222.333/0001-81". Se não tiver 14 dígitos devolve o texto como veio. */
export function formatarCnpj(valor: string): string {
  const d = soDigitos(valor);
  if (d.length !== 14) return valor;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
