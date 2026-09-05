/**
 * Personalização de avatar - estrutura e quantidade de categorias espelham o editor de personagem
 * do Gather (mandado como referência pelo usuário: "faça exatamente igual... todas as opções de
 * partes devem possuir mais do que a tela esta mostrando"), mas a arte é 100% original ("nada de
 * arte roubada/baixada do Gather", regra já estabelecida nesta sessão) - até a virada pra pixel
 * art real (LPC, ver `mundo/spriteAvatar.ts`). 11 categorias (Skin/Face/Hair/Facial hair/Top/
 * Jacket/Bottom/Shoes/Hat/Glasses/Other), cada uma com ~8-16 opções. "Face" (formato do rosto/
 * cabeça) não existe no Gather - pedido do usuário depois da virada pra LPC ("quero poder escolher
 * qual face irei utilizar... quero poder trocar o rosto"), possível porque o próprio LPC separa
 * cabeça de corpo em hierarquias diferentes. As 8 opções humanas iniciais de Face receberam mais 8
 * (1 humana + 7 criatura) depois do usuário reclamar que traziam "poucas diferenças" - só as 9
 * primeiras usam `corPele` (as criaturas têm cor própria fixa, ver `CAMADA_HEAD` no
 * `spriteAvatar.ts`). Depois o usuário pediu especificamente mais rostos HUMANOS (não criatura) -
 * como o LPC só tem 10 formatos de cabeça humana (9 já usados), as 6 opções `_MARCANTE`/
 * `_DELICADO` são as cabeças-base compostas com nariz+sobrancelha (pré-compostas em build time,
 * ver `scratchpad/lpc/compor-rostos.py`), não formato de cabeça novo - o LPC não tem mais desses.
 * `tipoCorpo` (Masculino/Feminino) foi adicionado depois: "O personagem pode ser masculino ou
 * feminino também!" - controla a silhueta do corpo (independente da Face, que só muda a cabeça).
 * Sem paleta de cor própria (usa `corPele`, mesmo padrão de `tipoRosto`).
 *
 * Os valores dos tipos union espelham EXATAMENTE os enums Java (`identidade/domain/`) - mesmos
 * nomes, sem tradução na borda. As paletas de cor espelham EXATAMENTE `PaletaAparenciaAvatar.java`
 * (mesmos hex, mesma ordem) - o servidor rejeita com 400 qualquer cor fora dessas listas.
 * `CORES_GERAL` é compartilhada por Top/Jacket/Bottom/Shoes/Hat/Glasses/Other (mesma paleta única
 * repetida em quase toda categoria nos prints de referência do Gather).
 */

export type TipoCorpo = 'MASCULINO' | 'FEMININO'
export type TipoRosto =
  | 'PADRAO'
  | 'OVAL'
  | 'ENVELHECIDA'
  | 'OVAL_ENVELHECIDA'
  | 'MAGRA'
  | 'ROBUSTA'
  | 'PEQUENA'
  | 'OVAL_PEQUENA'
  | 'IDOSA_PEQUENA'
  | 'PADRAO_MARCANTE'
  | 'PADRAO_DELICADO'
  | 'OVAL_MARCANTE'
  | 'OVAL_DELICADO'
  | 'ENVELHECIDA_MARCANTE'
  | 'OVAL_ENVELHECIDA_MARCANTE'
  | 'ALIENIGENA'
  | 'GOBLIN'
  | 'VAMPIRO'
  | 'LOBO'
  | 'COELHO'
  | 'ORC'
  | 'MINOTAURO'
export type EstiloCabelo = 'CARECA' | 'RASPADO' | 'CURTO' | 'REPARTIDO' | 'CACHEADO' | 'MOICANO' | 'RABO_DE_CAVALO' | 'CHIQUINHAS' | 'LONGO' | 'COQUE' | 'ESPETADO'
export type TipoBarba = 'NENHUM' | 'BIGODE_FINO' | 'BIGODE_GROSSO' | 'CAVANHAQUE' | 'SUICAS' | 'BARBA_CURTA' | 'BARBA_CHEIA' | 'CAVANHAQUE_BIGODE'
export type EstiloTop = 'CAMISETA' | 'REGATA' | 'POLO' | 'CAMISA' | 'SUETER' | 'LISTRADA' | 'GOLA_V' | 'GOLA_ALTA' | 'MOLETOM_LEVE'
export type EstiloJaqueta = 'NENHUMA' | 'JEANS' | 'BLAZER' | 'MOLETOM_CAPUZ' | 'COLETE' | 'CASACO_LONGO' | 'BOMBER' | 'CARDIGA' | 'COURO'
export type EstiloBottom = 'CALCA' | 'JEANS' | 'LEGGING' | 'SHORT' | 'BERMUDA' | 'SHORT_JEANS' | 'SAIA' | 'SAIA_LONGA' | 'CALCA_LISTRADA'
export type EstiloSapato = 'TENIS' | 'SOCIAL' | 'BOTA' | 'BOTA_CANO_ALTO' | 'SANDALIA' | 'CHINELO' | 'SALTO' | 'DESCALCO'
export type TipoChapeu = 'NENHUM' | 'BONE' | 'BONE_LATERAL' | 'GORRO' | 'CHAPEU_PRAIA' | 'BANDANA' | 'FAIXA' | 'CARTOLA' | 'CAPACETE' | 'TIARA'
export type TipoOculos = 'NENHUM' | 'REDONDO' | 'QUADRADO' | 'AVIADOR' | 'ESCUROS' | 'CORACAO' | 'ESTRELA' | 'MEIA_LUA' | 'MASCARA_MERGULHO' | 'TAPA_OLHO'
export type EstiloOutro = 'NENHUM' | 'BRINCO' | 'COLAR' | 'LENCO' | 'GRAVATA' | 'LACO' | 'BROCHE' | 'MICROFONE'

export interface AparenciaAvatar {
  corPele: string
  tipoCorpo: TipoCorpo
  tipoRosto: TipoRosto
  estiloCabelo: EstiloCabelo
  corCabelo: string
  tipoBarba: TipoBarba
  estiloTop: EstiloTop
  corTop: string
  estiloJaqueta: EstiloJaqueta
  corJaqueta: string
  estiloBottom: EstiloBottom
  corBottom: string
  estiloSapato: EstiloSapato
  corSapato: string
  chapeu: TipoChapeu
  corChapeu: string
  oculos: TipoOculos
  corOculos: string
  estiloOutro: EstiloOutro
  corOutro: string
}

/** Quem nunca personalizou nada (conta recém-criada) - mesmos valores de `AparenciaAvatar.padrao()`
 * no backend, usado só como fallback local antes do `GET /usuarios/me` responder. */
export const APARENCIA_PADRAO: AparenciaAvatar = {
  corPele: '#f2c9a0',
  tipoCorpo: 'MASCULINO',
  tipoRosto: 'PADRAO',
  estiloCabelo: 'CURTO',
  corCabelo: '#4a3728',
  tipoBarba: 'NENHUM',
  estiloTop: 'CAMISETA',
  corTop: '#6b7280',
  estiloJaqueta: 'NENHUMA',
  corJaqueta: '#6b7280',
  estiloBottom: 'CALCA',
  corBottom: '#2b2b3a',
  estiloSapato: 'TENIS',
  corSapato: '#1c1a28',
  chapeu: 'NENHUM',
  corChapeu: '#6b7280',
  oculos: 'NENHUM',
  corOculos: '#6b7280',
  estiloOutro: 'NENHUM',
  corOutro: '#6b7280',
}

export const CORES_PELE = ['#ffe0bd', '#f7dcc4', '#f2c9a0', '#d9a066', '#b97a4b', '#8a5a34', '#5c3a22', '#3a2317']

export const CORES_CABELO = ['#1c1a28', '#4a3728', '#8a5a34', '#c9a24a', '#d6672e', '#e0e0e0', '#8a4fd6', '#4fa8d6', '#f2f2f2']

/** Compartilhada por Top/Jacket/Bottom/Shoes/Hat/Glasses/Other - ver comentário do topo do arquivo. */
export const CORES_GERAL = [
  '#1c1a28', '#2b2b3a', '#6b7280', '#8a5a34', '#c9a24a', '#e8a33d', '#e0546f', '#e874c4',
  '#8a4fd6', '#4472c4', '#4fa8d6', '#4f9f6f', '#2f6f45', '#c0392b', '#f2f2f2', '#ffffff',
]

export const OPCOES_TIPO_CORPO: TipoCorpo[] = ['MASCULINO', 'FEMININO']
export const OPCOES_TIPO_ROSTO: TipoRosto[] = [
  'PADRAO', 'OVAL', 'ENVELHECIDA', 'OVAL_ENVELHECIDA', 'MAGRA', 'ROBUSTA', 'PEQUENA', 'OVAL_PEQUENA', 'IDOSA_PEQUENA',
  'PADRAO_MARCANTE', 'PADRAO_DELICADO', 'OVAL_MARCANTE', 'OVAL_DELICADO', 'ENVELHECIDA_MARCANTE', 'OVAL_ENVELHECIDA_MARCANTE',
  'ALIENIGENA', 'GOBLIN', 'VAMPIRO', 'LOBO', 'COELHO', 'ORC', 'MINOTAURO',
]
export const OPCOES_ESTILO_CABELO: EstiloCabelo[] = ['CARECA', 'RASPADO', 'CURTO', 'REPARTIDO', 'CACHEADO', 'MOICANO', 'RABO_DE_CAVALO', 'CHIQUINHAS', 'LONGO', 'COQUE', 'ESPETADO']
export const OPCOES_TIPO_BARBA: TipoBarba[] = ['NENHUM', 'BIGODE_FINO', 'BIGODE_GROSSO', 'CAVANHAQUE', 'SUICAS', 'BARBA_CURTA', 'BARBA_CHEIA', 'CAVANHAQUE_BIGODE']
export const OPCOES_ESTILO_TOP: EstiloTop[] = ['CAMISETA', 'REGATA', 'POLO', 'CAMISA', 'SUETER', 'LISTRADA', 'GOLA_V', 'GOLA_ALTA', 'MOLETOM_LEVE']
export const OPCOES_ESTILO_JAQUETA: EstiloJaqueta[] = ['NENHUMA', 'JEANS', 'BLAZER', 'MOLETOM_CAPUZ', 'COLETE', 'CASACO_LONGO', 'BOMBER', 'CARDIGA', 'COURO']
export const OPCOES_ESTILO_BOTTOM: EstiloBottom[] = ['CALCA', 'JEANS', 'LEGGING', 'SHORT', 'BERMUDA', 'SHORT_JEANS', 'SAIA', 'SAIA_LONGA', 'CALCA_LISTRADA']
export const OPCOES_ESTILO_SAPATO: EstiloSapato[] = ['TENIS', 'SOCIAL', 'BOTA', 'BOTA_CANO_ALTO', 'SANDALIA', 'CHINELO', 'SALTO', 'DESCALCO']
export const OPCOES_CHAPEU: TipoChapeu[] = ['NENHUM', 'BONE', 'BONE_LATERAL', 'GORRO', 'CHAPEU_PRAIA', 'BANDANA', 'FAIXA', 'CARTOLA', 'CAPACETE', 'TIARA']
export const OPCOES_OCULOS: TipoOculos[] = ['NENHUM', 'REDONDO', 'QUADRADO', 'AVIADOR', 'ESCUROS', 'CORACAO', 'ESTRELA', 'MEIA_LUA', 'MASCARA_MERGULHO', 'TAPA_OLHO']
export const OPCOES_ESTILO_OUTRO: EstiloOutro[] = ['NENHUM', 'BRINCO', 'COLAR', 'LENCO', 'GRAVATA', 'LACO', 'BROCHE', 'MICROFONE']

export const ROTULO_TIPO_CORPO: Record<TipoCorpo, string> = {
  MASCULINO: 'Masculino', FEMININO: 'Feminino',
}

export const ROTULO_TIPO_ROSTO: Record<TipoRosto, string> = {
  PADRAO: 'Padrão', OVAL: 'Oval', ENVELHECIDA: 'Envelhecida', OVAL_ENVELHECIDA: 'Oval envelhecida',
  MAGRA: 'Magra', ROBUSTA: 'Robusta', PEQUENA: 'Pequena', OVAL_PEQUENA: 'Oval pequena', IDOSA_PEQUENA: 'Idosa pequena',
  PADRAO_MARCANTE: 'Marcante', PADRAO_DELICADO: 'Delicado', OVAL_MARCANTE: 'Oval marcante', OVAL_DELICADO: 'Oval delicado',
  ENVELHECIDA_MARCANTE: 'Envelhecida marcante', OVAL_ENVELHECIDA_MARCANTE: 'Oval envelhecida marcante',
  ALIENIGENA: 'Alienígena', GOBLIN: 'Goblin', VAMPIRO: 'Vampiro', LOBO: 'Lobo', COELHO: 'Coelho', ORC: 'Orc', MINOTAURO: 'Minotauro',
}

export const ROTULO_ESTILO_CABELO: Record<EstiloCabelo, string> = {
  CARECA: 'Careca', RASPADO: 'Raspado', CURTO: 'Curto', REPARTIDO: 'Repartido', CACHEADO: 'Cacheado',
  MOICANO: 'Moicano', RABO_DE_CAVALO: 'Rabo de cavalo', CHIQUINHAS: 'Chiquinhas', LONGO: 'Longo', COQUE: 'Coque', ESPETADO: 'Espetado',
}

export const ROTULO_TIPO_BARBA: Record<TipoBarba, string> = {
  NENHUM: 'Nenhuma', BIGODE_FINO: 'Bigode fino', BIGODE_GROSSO: 'Bigode grosso', CAVANHAQUE: 'Cavanhaque',
  SUICAS: 'Suíças', BARBA_CURTA: 'Barba curta', BARBA_CHEIA: 'Barba cheia', CAVANHAQUE_BIGODE: 'Cavanhaque + bigode',
}

export const ROTULO_ESTILO_TOP: Record<EstiloTop, string> = {
  CAMISETA: 'Camiseta', REGATA: 'Regata', POLO: 'Polo', CAMISA: 'Camisa', SUETER: 'Suéter',
  LISTRADA: 'Listrada', GOLA_V: 'Gola V', GOLA_ALTA: 'Gola alta', MOLETOM_LEVE: 'Moletom leve',
}

export const ROTULO_ESTILO_JAQUETA: Record<EstiloJaqueta, string> = {
  NENHUMA: 'Nenhuma', JEANS: 'Jaqueta jeans', BLAZER: 'Blazer', MOLETOM_CAPUZ: 'Moletom c/ capuz',
  COLETE: 'Colete', CASACO_LONGO: 'Casaco longo', BOMBER: 'Bomber', CARDIGA: 'Cardigã', COURO: 'Jaqueta de couro',
}

export const ROTULO_ESTILO_BOTTOM: Record<EstiloBottom, string> = {
  CALCA: 'Calça', JEANS: 'Jeans', LEGGING: 'Legging', SHORT: 'Short', BERMUDA: 'Bermuda',
  SHORT_JEANS: 'Short jeans', SAIA: 'Saia', SAIA_LONGA: 'Saia longa', CALCA_LISTRADA: 'Calça listrada',
}

export const ROTULO_ESTILO_SAPATO: Record<EstiloSapato, string> = {
  TENIS: 'Tênis', SOCIAL: 'Social', BOTA: 'Bota', BOTA_CANO_ALTO: 'Bota cano alto',
  SANDALIA: 'Sandália', CHINELO: 'Chinelo', SALTO: 'Salto', DESCALCO: 'Descalço',
}

export const ROTULO_CHAPEU: Record<TipoChapeu, string> = {
  NENHUM: 'Nenhum', BONE: 'Boné', BONE_LATERAL: 'Boné de lado', GORRO: 'Gorro', CHAPEU_PRAIA: 'Chapéu de praia',
  BANDANA: 'Bandana', FAIXA: 'Faixa', CARTOLA: 'Cartola', CAPACETE: 'Capacete', TIARA: 'Tiara',
}

export const ROTULO_OCULOS: Record<TipoOculos, string> = {
  NENHUM: 'Nenhum', REDONDO: 'Redondo', QUADRADO: 'Quadrado', AVIADOR: 'Aviador', ESCUROS: 'Escuros',
  CORACAO: 'Coração', ESTRELA: 'Estrela', MEIA_LUA: 'Meia-lua', MASCARA_MERGULHO: 'Máscara de mergulho', TAPA_OLHO: 'Tapa-olho',
}

export const ROTULO_ESTILO_OUTRO: Record<EstiloOutro, string> = {
  NENHUM: 'Nenhum', BRINCO: 'Brinco', COLAR: 'Colar', LENCO: 'Lenço', GRAVATA: 'Gravata',
  LACO: 'Laço', BROCHE: 'Broche', MICROFONE: 'Microfone',
}
