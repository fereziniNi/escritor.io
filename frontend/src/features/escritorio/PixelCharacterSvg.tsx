import type { AparenciaAvatar } from './avatar/aparenciaAvatar'

const COR_CONTORNO = '#1c1a28'
const COR_PERNA = '#3a3550'

/**
 * Personagem "chibi" desenhado em SVG puro (retângulos com contorno preto, sem imagem/sprite
 * sheet) - gêmeo do `AvatarPixi.tsx` (mesmo viewBox 24×30, mesmas coordenadas/camadas), usado como
 * ícone estático em `MenuUsuario` e como prévia ao vivo em `avatar/EditorAvatarPage.tsx`.
 * Evoluíram junto pra não duplicar decisão de proporção/cor duas vezes.
 *
 * Personalização de avatar: recebe `aparencia` (pele/cabelo/roupa/acessórios) em camadas, mesma
 * composição do lado Pixi - roupa embaixo, corpo(pele+olhos) por cima, cabelo por cima da cabeça,
 * óculos/chapéu por último. `corStatus` é opcional (o indicador de status não faz sentido na
 * prévia do editor, só no mundo/menu).
 */
export function PixelCharacterSvg({
  aparencia,
  corStatus,
  direcao,
  andando,
  destaque,
}: {
  aparencia: AparenciaAvatar
  corStatus?: string
  direcao: 'esquerda' | 'direita'
  andando: boolean
  destaque: boolean
}) {
  const mangaCurta = aparencia.estiloRoupa === 'REGATA'
  const larguraManga = mangaCurta ? 2.1 : 3.4
  const alturaManga = mangaCurta ? 4.2 : 7.5

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
      <rect className="escritorio-perna escritorio-perna--esquerda" x="7" y="20" width="4" height="7" rx="1.3" fill={COR_PERNA} stroke={COR_CONTORNO} strokeWidth="1" />
      <rect className="escritorio-perna escritorio-perna--direita" x="13" y="20" width="4" height="7" rx="1.3" fill={COR_PERNA} stroke={COR_CONTORNO} strokeWidth="1" />

      {/* roupa: capuz do moletom (atrás do pescoço) */}
      {aparencia.estiloRoupa === 'MOLETOM' && (
        <rect x="7" y="9.3" width="10" height="3.2" rx="2" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1" />
      )}

      {/* roupa: mangas */}
      <rect x="1.5" y="12" width={larguraManga} height={alturaManga} rx="1.6" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1" />
      <rect x={22.5 - larguraManga} y="12" width={larguraManga} height={alturaManga} rx="1.6" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1" />

      {/* roupa: tronco */}
      <rect x="4.5" y="11" width="15" height="10" rx="4" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <rect x="6.5" y="12.5" width="8" height="3.5" rx="2" fill="#ffffff" opacity="0.18" />
      {aparencia.estiloRoupa === 'JAQUETA' && (
        <>
          <rect x="9" y="10.6" width="6" height="2" rx="1" fill="#ffffff" opacity="0.22" />
          <line x1="12" y1="11.4" x2="12" y2="20.2" stroke={COR_CONTORNO} strokeWidth="1" opacity="0.55" />
        </>
      )}

      {/* corpo base: cabeça/olhos */}
      <rect x="6.5" y="1.5" width="11" height="10" rx="4" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <circle cx="9.5" cy="7.2" r="1.1" fill="#ffffff" opacity="0.25" />
      <rect x="9.2" y="6.6" width="1.6" height="1.8" rx="0.4" fill={COR_CONTORNO} />
      <rect x="13.2" y="6.6" width="1.6" height="1.8" rx="0.4" fill={COR_CONTORNO} />

      {/* cabelo */}
      {aparencia.estiloCabelo !== 'CARECA' && (
        <>
          <rect x="5.8" y="0.5" width="12.4" height="4.2" rx="2.4" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="6.6" y="0.8" width="5.5" height="1.6" rx="1" fill="#ffffff" opacity="0.12" />
          {(aparencia.estiloCabelo === 'MEDIO' || aparencia.estiloCabelo === 'LONGO') && (
            <>
              <rect x="5.3" y="2.3" width="2.6" height="5.5" rx="1.3" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="16.1" y="2.3" width="2.6" height="5.5" rx="1.3" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          )}
          {aparencia.estiloCabelo === 'LONGO' && (
            <>
              <rect x="5.3" y="6.9" width="2.4" height="6.8" rx="1.2" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="16.3" y="6.9" width="2.4" height="6.8" rx="1.2" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          )}
        </>
      )}

      {/* óculos */}
      {aparencia.oculos === 'REDONDO' && (
        <>
          <circle cx="10" cy="7.4" r="1.6" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <circle cx="14" cy="7.4" r="1.6" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <line x1="11.6" y1="7.3" x2="12.4" y2="7.3" stroke={COR_CONTORNO} strokeWidth="1" />
        </>
      )}
      {aparencia.oculos === 'QUADRADO' && (
        <>
          <rect x="8.6" y="6" width="2.8" height="2.6" rx="0.6" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="12.6" y="6" width="2.8" height="2.6" rx="0.6" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <line x1="11.4" y1="7.3" x2="12.6" y2="7.3" stroke={COR_CONTORNO} strokeWidth="1" />
        </>
      )}

      {/* chapéu */}
      {aparencia.chapeu === 'BONE' && (
        <>
          <rect x="5.5" y="-0.3" width="13" height="4.5" rx="3" fill="#2b6cb0" stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="3.3" y="2" width="5.2" height="1.6" rx="1" fill="#2b6cb0" stroke={COR_CONTORNO} strokeWidth="1" />
        </>
      )}
      {aparencia.chapeu === 'GORRO' && (
        <>
          <rect x="5.2" y="-0.8" width="13.6" height="6" rx="4" fill="#c0392b" stroke={COR_CONTORNO} strokeWidth="1" />
          <circle cx="12" cy="-1.4" r="1.3" fill="#ffffff" stroke={COR_CONTORNO} strokeWidth="1" />
        </>
      )}

      {/* indicador de status */}
      {corStatus && <circle cx="19.3" cy="19.3" r="2.2" fill={corStatus} stroke="#ffffff" strokeWidth="1.2" />}
    </svg>
  )
}
