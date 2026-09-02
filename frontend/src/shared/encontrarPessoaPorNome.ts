export interface PessoaBasica {
  id: number
  nome: string
}

/** Pedido do cliente: referenciar pessoa por nome, não por id, em qualquer lugar do sistema -
 * casamento exato (ignorando maiúsculas/minúsculas e espaço nas pontas) contra a lista de
 * pessoas cadastradas sugerida no autocomplete (`CampoPessoa`). Função pura só pra ficar
 * testável sem precisar montar o componente inteiro. */
export function encontrarPessoaPorNome(pessoas: PessoaBasica[], nomeDigitado: string): PessoaBasica | null {
  const alvo = nomeDigitado.trim().toLowerCase()
  if (alvo === '') {
    return null
  }
  return pessoas.find((pessoa) => pessoa.nome.trim().toLowerCase() === alvo) ?? null
}

/** "Pessoa não encontrada" só deve aparecer quando não sobra NENHUM candidato - não a cada tecla
 * de um nome ainda incompleto (ex.: "b" enquanto o usuário está digitando "Beto Lima", que
 * `CampoPessoa` já está sugerindo no dropdown). Casamento por substring, mesmo critério que
 * `CampoPessoa` usa pra decidir quais opções mostrar - propositalmente mais permissivo que
 * `encontrarPessoaPorNome` (que exige nome exato e decide o id de verdade a enviar). */
export function existeSugestaoPara(pessoas: PessoaBasica[], nomeDigitado: string): boolean {
  const alvo = nomeDigitado.trim().toLowerCase()
  if (alvo === '') {
    return true
  }
  return pessoas.some((pessoa) => pessoa.nome.toLowerCase().includes(alvo))
}
