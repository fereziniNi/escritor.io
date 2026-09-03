import type { AparenciaAvatar } from './avatar/aparenciaAvatar'

const COR_CONTORNO = '#1c1a28'

function escurecer(cor: string, fator: number): string {
  const numero = Number(cor.replace('#', '0x'))
  const r = Math.round(((numero >> 16) & 0xff) * (1 - fator))
  const g = Math.round(((numero >> 8) & 0xff) * (1 - fator))
  const b = Math.round((numero & 0xff) * (1 - fator))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Personagem "chibi" desenhado em SVG puro (retângulos/círculos com contorno preto, sem imagem/
 * sprite sheet) - gêmeo do `AvatarPixi.tsx`/`mundo/avatarFactory.ts` (mesmo viewBox 24×30, mesmas
 * coordenadas/camadas/detalhe - cabeça proporcionalmente maior, 3 tons de sombra, mãos/sapatos,
 * barba), usado como ícone estático em `MenuUsuario` e como prévia ao vivo em
 * `avatar/EditorAvatarPage.tsx`. Evoluem junto pra não duplicar decisão de proporção/cor duas vezes.
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
  const corCalca = escurecer(aparencia.corRoupa, 0.35)

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

      {/* pernas + sapatos */}
      <rect x="7" y="20" width="4" height="6.2" rx="1.3" fill={corCalca} stroke={COR_CONTORNO} strokeWidth="1" />
      <rect x="13" y="20" width="4" height="6.2" rx="1.3" fill={corCalca} stroke={COR_CONTORNO} strokeWidth="1" />
      <ellipse cx="9" cy="27" rx="2.2" ry="1.5" fill={COR_CONTORNO} />
      <ellipse cx="15" cy="27" rx="2.2" ry="1.5" fill={COR_CONTORNO} />

      {/* roupa: capuz do moletom (atrás do pescoço) */}
      {aparencia.estiloRoupa === 'MOLETOM' && (
        <rect x="7" y="9.3" width="10" height="3.2" rx="2" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1" />
      )}

      {/* roupa: mangas */}
      <rect x="1.5" y="12" width={larguraManga} height={alturaManga} rx="1.6" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1" />
      <rect x={22.5 - larguraManga} y="12" width={larguraManga} height={alturaManga} rx="1.6" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1" />

      {/* mãos */}
      <circle cx={1.5 + larguraManga / 2} cy={12 + alturaManga + 0.7} r="1.2" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="0.8" />
      <circle cx={22.5 - larguraManga / 2} cy={12 + alturaManga + 0.7} r="1.2" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="0.8" />

      {/* roupa: tronco */}
      <rect x="4.5" y="11" width="15" height="10" rx="4" fill={aparencia.corRoupa} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <rect x="6.5" y="12.5" width="8" height="3.5" rx="2" fill="#ffffff" opacity="0.18" />
      <rect x="6" y="18" width="12" height="2.4" rx="2" fill="#000000" opacity="0.13" />
      {aparencia.estiloRoupa === 'JAQUETA' && (
        <>
          <rect x="9" y="10.6" width="6" height="2" rx="1" fill="#ffffff" opacity="0.22" />
          <line x1="12" y1="11.4" x2="12" y2="20.2" stroke={COR_CONTORNO} strokeWidth="1" opacity="0.55" />
        </>
      )}

      {/* corpo base: cabeça (proporção chibi maior) */}
      <rect x="5.5" y="0.5" width="13" height="11" rx="5" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <rect x="8" y="9" width="8" height="2.2" rx="1.4" fill="#000000" opacity="0.12" />
      <rect x="6.3" y="1" width="6" height="2" rx="1.2" fill="#ffffff" opacity="0.28" />
      <circle cx="9.6" cy="7.6" r="1.2" fill="#ffffff" opacity="0.22" />
      <circle cx="9.6" cy="6.8" r="1.15" fill={COR_CONTORNO} />
      <circle cx="14.4" cy="6.8" r="1.15" fill={COR_CONTORNO} />
      <circle cx="9.9" cy="6.4" r="0.42" fill="#ffffff" />
      <circle cx="14.7" cy="6.4" r="0.42" fill="#ffffff" />

      {/* barba */}
      {aparencia.tipoBarba === 'BIGODE' && (
        <rect x="10.3" y="8.1" width="3.4" height="0.9" rx="0.45" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.6" />
      )}
      {aparencia.tipoBarba === 'CAVANHAQUE' && (
        <rect x="10.6" y="9.4" width="2.8" height="2" rx="1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
      )}
      {aparencia.tipoBarba === 'BARBA_CHEIA' && (
        <>
          <rect x="6.3" y="8" width="11.4" height="3.6" rx="3" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="7" y="8.4" width="4" height="1.1" rx="0.7" fill="#ffffff" opacity="0.15" />
        </>
      )}

      {/* cabelo */}
      {aparencia.estiloCabelo !== 'CARECA' && (
        <>
          <rect x="5.2" y="-0.3" width="13.6" height="4.6" rx="2.6" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="6.5" y="-1.1" width="2.6" height="2.2" rx="1.1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
          <rect x="10.7" y="-1.4" width="2.6" height="2.4" rx="1.1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
          <rect x="14.9" y="-1.1" width="2.6" height="2.2" rx="1.1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
          <rect x="6.6" y="0.1" width="6" height="1.6" rx="1" fill="#ffffff" opacity="0.14" />
          {(aparencia.estiloCabelo === 'MEDIO' || aparencia.estiloCabelo === 'LONGO') && (
            <>
              <rect x="4.7" y="2" width="2.7" height="5.8" rx="1.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="16.6" y="2" width="2.7" height="5.8" rx="1.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          )}
          {aparencia.estiloCabelo === 'LONGO' && (
            <>
              <rect x="4.7" y="7.4" width="2.5" height="7.2" rx="1.25" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="16.8" y="7.4" width="2.5" height="7.2" rx="1.25" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          )}
        </>
      )}

      {/* óculos */}
      {aparencia.oculos === 'REDONDO' && (
        <>
          <circle cx="9.6" cy="6.8" r="1.7" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <circle cx="14.4" cy="6.8" r="1.7" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <line x1="11.2" y1="6.7" x2="12.8" y2="6.7" stroke={COR_CONTORNO} strokeWidth="1" />
        </>
      )}
      {aparencia.oculos === 'QUADRADO' && (
        <>
          <rect x="8.1" y="5.5" width="3" height="2.8" rx="0.6" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="12.9" y="5.5" width="3" height="2.8" rx="0.6" fill="none" stroke={COR_CONTORNO} strokeWidth="1" />
          <line x1="11.2" y1="6.7" x2="12.8" y2="6.7" stroke={COR_CONTORNO} strokeWidth="1" />
        </>
      )}

      {/* chapéu */}
      {aparencia.chapeu === 'BONE' && (
        <>
          <rect x="5.3" y="-1.1" width="13.4" height="4.5" rx="3" fill="#2b6cb0" stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="3.1" y="1.4" width="5.4" height="1.6" rx="1" fill="#2b6cb0" stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="6" y="-0.8" width="5" height="1.4" rx="0.8" fill="#ffffff" opacity="0.2" />
        </>
      )}
      {aparencia.chapeu === 'GORRO' && (
        <>
          <rect x="5" y="-1.6" width="14" height="6.2" rx="4" fill="#c0392b" stroke={COR_CONTORNO} strokeWidth="1" />
          <circle cx="12" cy="-2.2" r="1.4" fill="#ffffff" stroke={COR_CONTORNO} strokeWidth="1" />
          <rect x="5.6" y="-1.3" width="5" height="1.6" rx="0.9" fill="#ffffff" opacity="0.16" />
        </>
      )}

      {/* indicador de status */}
      {corStatus && <circle cx="19.3" cy="19.3" r="2.2" fill={corStatus} stroke="#ffffff" strokeWidth="1.2" />}
    </svg>
  )
}
