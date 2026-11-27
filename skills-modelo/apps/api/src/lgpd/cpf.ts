/** CPF como é cifrado e indexado: só os 11 dígitos. Aceita com ou sem pontuação (`123.456.789-09`); outro formato → null. */
export function normalizarCpf(texto: string): string | null {
  const t = texto.trim();
  if (!/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(t)) return null;
  return t.replace(/\D/g, '');
}

/** Dígito verificador do CPF para os `n` primeiros dígitos (pesos n+1 .. 2). */
function digito(digitos: string, n: number): number {
  let soma = 0;
  for (let i = 0; i < n; i++) soma += Number(digitos[i]) * (n + 1 - i);
  return ((soma * 10) % 11) % 10;
}

/** CPF válido: 11 dígitos, não repetidos (111.111.111-11) e com os dois dígitos verificadores certos. */
export function cpfValido(texto: string): boolean {
  const d = normalizarCpf(texto);
  if (d === null || /^(\d)\1{10}$/.test(d)) return false;
  return digito(d, 9) === Number(d[9]) && digito(d, 10) === Number(d[10]);
}
