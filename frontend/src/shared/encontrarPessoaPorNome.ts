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
