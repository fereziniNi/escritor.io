/**
 * Personagem "chibi" desenhado em SVG puro (retângulos com contorno preto, sem imagem/sprite
 * sheet - nenhuma dependência nova, mesmo espírito de não adicionar `<canvas>`/lib de jogo,
 * ver `EscritorioPage`). `corCorpo` reflete o status (ver `COR_STATUS`) - dá pra ler o status à
 * distância no mapa, o emoji do badge é reforço, não a única pista. `direcao` espelha o SVG
 * horizontalmente (pra qual lado a pessoa andou por último) e `andando` balança as pernas -
 * ambos calculados a partir da posição recebida do servidor, não de um sprite sheet de
 * caminhada de verdade.
 */
export function PixelCharacterSvg({
  corCorpo,
  direcao,
  andando,
  destaque,
}: {
  corCorpo: string
  direcao: 'esquerda' | 'direita'
  andando: boolean
  destaque: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 30"
      width="30"
      height="38"
      shapeRendering="crispEdges"
      className={`escritorio-personagem-svg${andando ? ' escritorio-personagem-svg--andando' : ''}`}
      style={{ transform: direcao === 'esquerda' ? 'scaleX(-1)' : undefined }}
    >
      {destaque && <circle cx="12" cy="16" r="15" fill="none" stroke="#f2a541" strokeWidth="2" opacity="0.9" />}

      {/* pernas */}
      <rect className="escritorio-perna escritorio-perna--esquerda" x="7" y="20" width="4" height="7" rx="1.3" fill="#3a3550" stroke="#1c1a28" strokeWidth="1" />
      <rect className="escritorio-perna escritorio-perna--direita" x="13" y="20" width="4" height="7" rx="1.3" fill="#3a3550" stroke="#1c1a28" strokeWidth="1" />

      {/* braços */}
      <rect x="1.5" y="12" width="3.4" height="7.5" rx="1.6" fill={corCorpo} stroke="#1c1a28" strokeWidth="1" />
      <rect x="19" y="12" width="3.4" height="7.5" rx="1.6" fill={corCorpo} stroke="#1c1a28" strokeWidth="1" />

      {/* corpo */}
      <rect x="4.5" y="11" width="15" height="10" rx="4" fill={corCorpo} stroke="#1c1a28" strokeWidth="1.2" />

      {/* cabeça */}
      <rect x="6.5" y="1.5" width="11" height="10" rx="4" fill="#f2c9a0" stroke="#1c1a28" strokeWidth="1.2" />
      {/* cabelo */}
      <rect x="5.8" y="0.5" width="12.4" height="4.2" rx="2.4" fill="#4a3728" stroke="#1c1a28" strokeWidth="1" />
      {/* olhos */}
      <rect x="9.2" y="6.6" width="1.6" height="1.8" rx="0.4" fill="#1c1a28" />
      <rect x="13.2" y="6.6" width="1.6" height="1.8" rx="0.4" fill="#1c1a28" />
    </svg>
  )
}
