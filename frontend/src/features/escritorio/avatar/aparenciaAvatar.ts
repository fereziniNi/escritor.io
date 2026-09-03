/**
 * Personalização de avatar (pedido do usuário: "o personagem fosse mais detalhado... a opção
 * para todos detalhar da melhor maneira possível o avatar", com prints reais do editor de
 * personagem do Gather como referência de composição de UI/categorias - não de sprite a copiar,
 * continua tudo desenhado via `PIXI.Graphics`/SVG, sem asset de imagem, mesma regra já
 * estabelecida pro resto do mundo).
 *
 * Os valores dos tipos union espelham EXATAMENTE os enums Java (`EstiloCabelo`/`EstiloRoupa`/
 * `TipoOculos`/`TipoChapeu` em `identidade/domain/`) - mesmos nomes, sem tradução na borda. As
 * paletas de cor espelham EXATAMENTE `PaletaAparenciaAvatar.java` (mesmos hex, mesma ordem) - o
 * servidor rejeita com 400 qualquer cor fora dessas listas, então uma paleta diferente aqui faria
 * o editor oferecer uma cor que o PATCH depois recusa. Qualquer mudança aqui precisa da mudança
 * irmã lá.
 */

export type EstiloCabelo = 'CARECA' | 'CURTO' | 'MEDIO' | 'LONGO'
export type EstiloRoupa = 'CAMISETA' | 'MOLETOM' | 'JAQUETA' | 'REGATA'
export type TipoOculos = 'NENHUM' | 'REDONDO' | 'QUADRADO'
export type TipoChapeu = 'NENHUM' | 'BONE' | 'GORRO'

export interface AparenciaAvatar {
  corPele: string
  estiloCabelo: EstiloCabelo
  corCabelo: string
  estiloRoupa: EstiloRoupa
  corRoupa: string
  oculos: TipoOculos
  chapeu: TipoChapeu
}

/** Quem nunca personalizou nada (conta recém-criada) - mesmos valores de `AparenciaAvatar.padrao()`
 * no backend, usado só como fallback local antes do `GET /usuarios/me` responder. */
export const APARENCIA_PADRAO: AparenciaAvatar = {
  corPele: '#f2c9a0',
  estiloCabelo: 'CURTO',
  corCabelo: '#4a3728',
  estiloRoupa: 'CAMISETA',
  corRoupa: '#6b7280',
  oculos: 'NENHUM',
  chapeu: 'NENHUM',
}

export const CORES_PELE = ['#f7dcc4', '#f2c9a0', '#d9a066', '#b97a4b', '#8a5a34', '#5c3a22']

export const CORES_CABELO = ['#1c1a28', '#4a3728', '#8a5a34', '#c9a24a', '#d6672e', '#e0e0e0', '#8a4fd6', '#4fa8d6']

export const CORES_ROUPA = ['#6b7280', '#e0546f', '#4472c4', '#4f9f6f', '#e8a33d', '#8a5a34', '#2b2b3a', '#f2f2f2', '#8a4fd6', '#e874c4']

export const OPCOES_ESTILO_CABELO: EstiloCabelo[] = ['CARECA', 'CURTO', 'MEDIO', 'LONGO']
export const OPCOES_ESTILO_ROUPA: EstiloRoupa[] = ['CAMISETA', 'MOLETOM', 'JAQUETA', 'REGATA']
export const OPCOES_OCULOS: TipoOculos[] = ['NENHUM', 'REDONDO', 'QUADRADO']
export const OPCOES_CHAPEU: TipoChapeu[] = ['NENHUM', 'BONE', 'GORRO']

export const ROTULO_ESTILO_CABELO: Record<EstiloCabelo, string> = {
  CARECA: 'Careca',
  CURTO: 'Curto',
  MEDIO: 'Médio',
  LONGO: 'Longo',
}

export const ROTULO_ESTILO_ROUPA: Record<EstiloRoupa, string> = {
  CAMISETA: 'Camiseta',
  MOLETOM: 'Moletom',
  JAQUETA: 'Jaqueta',
  REGATA: 'Regata',
}

export const ROTULO_OCULOS: Record<TipoOculos, string> = {
  NENHUM: 'Nenhum',
  REDONDO: 'Redondo',
  QUADRADO: 'Quadrado',
}

export const ROTULO_CHAPEU: Record<TipoChapeu, string> = {
  NENHUM: 'Nenhum',
  BONE: 'Boné',
  GORRO: 'Gorro',
}
