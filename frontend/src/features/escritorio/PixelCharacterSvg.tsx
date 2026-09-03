import type { AparenciaAvatar } from './avatar/aparenciaAvatar'

const COR_CONTORNO = '#1c1a28'

function escurecer(cor: string, fator: number): string {
  const numero = Number(cor.replace('#', '0x'))
  const r = Math.round(((numero >> 16) & 0xff) * (1 - fator))
  const g = Math.round(((numero >> 8) & 0xff) * (1 - fator))
  const b = Math.round((numero & 0xff) * (1 - fator))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Peça de baixo (cintura-tornozelo) - gêmeo SVG de `desenharBottom` em `mundo/avatarFactory.ts`. */
function Bottom({ estilo, cor, x, corCalca }: { estilo: AparenciaAvatar['estiloBottom']; cor: string; x: number; corCalca: string }) {
  switch (estilo) {
    case 'SHORT':
    case 'SHORT_JEANS':
      return <rect x={x - 2} y="0" width="4" height="2.6" rx="1.2" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'SAIA':
      return <polygon points={`${x - 1.3},0 ${x + 1.3},0 ${x + 2.6},4.2 ${x - 2.6},4.2`} fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'SAIA_LONGA':
      return <polygon points={`${x - 1.3},0 ${x + 1.3},0 ${x + 2.9},6.2 ${x - 2.9},6.2`} fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'LEGGING':
      return <rect x={x - 1.6} y="0" width="3.2" height="6.2" rx="1" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    default:
      return <rect x={x - 2} y="0" width="4" height="6.2" rx="1.3" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
  }
  // corCalca reservado pra paridade de assinatura com o lado Pixi (costuras/textura ficam só lá,
  // a prévia SVG é pequena demais pra esse nível de detalhe valer a pena)
  void corCalca
}

function Sapato({ estilo, cor, x }: { estilo: AparenciaAvatar['estiloSapato']; cor: string; x: number }) {
  if (estilo === 'DESCALCO') return null
  switch (estilo) {
    case 'BOTA':
      return <rect x={x - 2} y="4.4" width="4" height="3.2" rx="1" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'BOTA_CANO_ALTO':
      return <rect x={x - 2} y="2.2" width="4" height="5.4" rx="1" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'SALTO':
      return <polygon points={`${x - 2},6.1 ${x + 2},6.1 ${x + 1.2},7.6 ${x - 1.6},7`} fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    default:
      return <ellipse cx={x} cy="6.7" rx="2.2" ry="1.3" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
  }
}

/**
 * Personagem "chibi" desenhado em SVG puro - gêmeo de `AvatarPixi.tsx`/`mundo/avatarFactory.ts`
 * (mesmo viewBox 24×30, mesmas coordenadas/10 camadas), usado como ícone estático em `MenuUsuario`
 * e como prévia ao vivo em `avatar/EditorAvatarPage.tsx`.
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
  const mangaCurta = aparencia.estiloTop === 'REGATA'
  const larguraManga = mangaCurta ? 2.1 : 3.4
  const alturaManga = mangaCurta ? 4.2 : 7.5
  const corCalca = escurecer(aparencia.corBottom, 0.15)

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

      {/* pernas: bottom + sapato */}
      <g transform="translate(9,20)">
        <Bottom estilo={aparencia.estiloBottom} cor={aparencia.corBottom} corCalca={corCalca} x={0} />
        <Sapato estilo={aparencia.estiloSapato} cor={aparencia.corSapato} x={0} />
      </g>
      <g transform="translate(15,20)">
        <Bottom estilo={aparencia.estiloBottom} cor={aparencia.corBottom} corCalca={corCalca} x={0} />
        <Sapato estilo={aparencia.estiloSapato} cor={aparencia.corSapato} x={0} />
      </g>

      {/* top: capuz do moletom leve (atrás do pescoço) */}
      {aparencia.estiloTop === 'MOLETOM_LEVE' && (
        <rect x="7" y="9.3" width="10" height="3.2" rx="2" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1" />
      )}

      {/* top: mangas + mãos */}
      <rect x="1.5" y="12" width={larguraManga} height={alturaManga} rx="1.6" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1" />
      <rect x={22.5 - larguraManga} y="12" width={larguraManga} height={alturaManga} rx="1.6" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1" />
      <circle cx={1.5 + larguraManga / 2} cy={12 + alturaManga + 0.7} r="1.2" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="0.8" />
      <circle cx={22.5 - larguraManga / 2} cy={12 + alturaManga + 0.7} r="1.2" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="0.8" />

      {/* top: tronco */}
      <rect x="4.5" y="11" width="15" height="10" rx="4" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <rect x="6.5" y="12.5" width="8" height="3.5" rx="2" fill="#ffffff" opacity="0.18" />
      <rect x="6" y="18" width="12" height="2.4" rx="2" fill="#000000" opacity="0.13" />
      {aparencia.estiloTop === 'GOLA_V' && (
        <polyline points="9.5,11 12,14.5 14.5,11" fill="none" stroke={escurecer(aparencia.corTop, 0.3)} strokeWidth="1" />
      )}
      {(aparencia.estiloTop === 'SUETER' || aparencia.estiloTop === 'GOLA_ALTA') && (
        <rect x="8.5" y="9.6" width="7" height="2" rx="1" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1" />
      )}
      {aparencia.estiloTop === 'LISTRADA' &&
        [12.6, 14.5, 16.4, 18.3].map((y) => <rect key={y} x="4.5" y={y} width="15" height="0.6" fill={escurecer(aparencia.corTop, 0.25)} opacity="0.55" />)}

      {/* jaqueta (opcional, por cima do top) */}
      {aparencia.estiloJaqueta !== 'NENHUMA' && (
        <>
          <rect x="3.8" y="10.6" width="6.4" height="10.6" rx="3" fill={aparencia.corJaqueta} stroke={COR_CONTORNO} strokeWidth="1.2" />
          <rect x="13.8" y="10.6" width="6.4" height="10.6" rx="3" fill={aparencia.corJaqueta} stroke={COR_CONTORNO} strokeWidth="1.2" />
          <rect x="4.4" y="11.2" width="3" height="2.6" rx="1.5" fill="#ffffff" opacity="0.16" />
        </>
      )}

      {/* corpo base: cabeça */}
      <rect x="5.5" y="0.5" width="13" height="11" rx="5" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <rect x="8" y="9" width="8" height="2.2" rx="1.4" fill="#000000" opacity="0.12" />
      <rect x="6.3" y="1" width="6" height="2" rx="1.2" fill="#ffffff" opacity="0.28" />
      <circle cx="9.6" cy="7.6" r="1.2" fill="#ffffff" opacity="0.22" />
      <circle cx="9.6" cy="6.8" r="1.15" fill={COR_CONTORNO} />
      <circle cx="14.4" cy="6.8" r="1.15" fill={COR_CONTORNO} />
      <circle cx="9.9" cy="6.4" r="0.42" fill="#ffffff" />
      <circle cx="14.7" cy="6.4" r="0.42" fill="#ffffff" />

      {/* barba */}
      {(aparencia.tipoBarba === 'BIGODE_FINO' || aparencia.tipoBarba === 'CAVANHAQUE_BIGODE') && (
        <rect x="10.3" y="8.1" width="3.4" height="0.7" rx="0.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.5" />
      )}
      {aparencia.tipoBarba === 'BIGODE_GROSSO' && (
        <rect x="10" y="8" width="4" height="1.1" rx="0.55" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.6" />
      )}
      {(aparencia.tipoBarba === 'CAVANHAQUE' || aparencia.tipoBarba === 'CAVANHAQUE_BIGODE') && (
        <rect x="10.6" y="9.4" width="2.8" height="2" rx="1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
      )}
      {aparencia.tipoBarba === 'SUICAS' && (
        <>
          <rect x="5.7" y="6" width="1.6" height="3.6" rx="0.8" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.7" />
          <rect x="16.7" y="6" width="1.6" height="3.6" rx="0.8" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.7" />
        </>
      )}
      {aparencia.tipoBarba === 'BARBA_CURTA' && (
        <rect x="6.8" y="8.2" width="10.4" height="2.8" rx="2.4" fill={aparencia.corCabelo} opacity="0.85" stroke={COR_CONTORNO} strokeWidth="0.8" />
      )}
      {aparencia.tipoBarba === 'BARBA_CHEIA' && (
        <rect x="6.3" y="8" width="11.4" height="3.8" rx="3" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
      )}

      {/* cabelo */}
      {aparencia.estiloCabelo === 'RASPADO' && (
        <rect x="5.5" y="-0.1" width="13" height="1.8" rx="0.9" fill={aparencia.corCabelo} opacity="0.75" stroke={COR_CONTORNO} strokeWidth="0.8" />
      )}
      {aparencia.estiloCabelo === 'MOICANO' && (
        <rect x="10.4" y="-1.8" width="3.2" height="5.2" rx="1.5" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
      )}
      {aparencia.estiloCabelo === 'ESPETADO' &&
        [6, 9, 12, 15, 18].map((x) => (
          <polygon key={x} points={`${x - 1.4},3 ${x},-2.2 ${x + 1.4},3`} fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
        ))}
      {aparencia.estiloCabelo !== 'CARECA' && aparencia.estiloCabelo !== 'RASPADO' && aparencia.estiloCabelo !== 'MOICANO' && aparencia.estiloCabelo !== 'ESPETADO' && (
        <>
          <rect x="5.2" y="-0.3" width="13.6" height="4.6" rx="2.6" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
          {aparencia.estiloCabelo !== 'CACHEADO' && (
            <>
              <rect x="6.5" y="-1.1" width="2.6" height="2.2" rx="1.1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
              <rect x="10.7" y="-1.4" width="2.6" height="2.4" rx="1.1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
              <rect x="14.9" y="-1.1" width="2.6" height="2.2" rx="1.1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
            </>
          )}
          <rect x="6.6" y="0.1" width="6" height="1.6" rx="1" fill="#ffffff" opacity="0.14" />
          {aparencia.estiloCabelo === 'CACHEADO' &&
            [
              [7, 0.5],
              [9.5, -0.6],
              [12, -1],
              [14.5, -0.6],
              [17, 0.5],
            ].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="1.6" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.9" />)}
          {aparencia.estiloCabelo === 'RABO_DE_CAVALO' && (
            <rect x="10.4" y="4" width="3.2" height="6.5" rx="1.6" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
          )}
          {aparencia.estiloCabelo === 'CHIQUINHAS' && (
            <>
              <circle cx="4.6" cy="3" r="1.9" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <circle cx="19.4" cy="3" r="1.9" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          )}
          {aparencia.estiloCabelo === 'LONGO' && (
            <>
              <rect x="4.7" y="2" width="2.7" height="5.8" rx="1.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="16.6" y="2" width="2.7" height="5.8" rx="1.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="4.7" y="7.4" width="2.5" height="7.2" rx="1.25" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="16.8" y="7.4" width="2.5" height="7.2" rx="1.25" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          )}
          {aparencia.estiloCabelo === 'COQUE' && <circle cx="12" cy="-1.6" r="2.1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />}
        </>
      )}

      {/* chapéu */}
      {aparencia.chapeu !== 'NENHUM' && (
        <>
          {aparencia.chapeu === 'GORRO' ? (
            <>
              <rect x="5" y="-1.6" width="14" height="6.2" rx="4" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <circle cx="12" cy="-2.2" r="1.4" fill="#ffffff" stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.chapeu === 'CARTOLA' ? (
            <>
              <rect x="7" y="-4.8" width="10" height="5" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="5" y="-0.4" width="14" height="1.3" rx="0.6" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.chapeu === 'CAPACETE' ? (
            <circle cx="12" cy="1" r="7.3" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1.2" />
          ) : aparencia.chapeu === 'CHAPEU_PRAIA' ? (
            <>
              <ellipse cx="12" cy="0.6" rx="9.2" ry="2.2" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="7.2" y="-2" width="9.6" height="3" rx="2" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.chapeu === 'FAIXA' || aparencia.chapeu === 'TIARA' ? (
            <rect x="5.3" y={aparencia.chapeu === 'TIARA' ? 0.5 : 0.8} width="13.4" height={aparencia.chapeu === 'TIARA' ? 1 : 1.6} rx="0.6" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="0.8" />
          ) : aparencia.chapeu === 'BANDANA' ? (
            <rect x="5.3" y="-0.6" width="13.4" height="3" rx="1.5" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
          ) : (
            <>
              <rect x="5.3" y="-1.1" width="13.4" height="4.5" rx="3" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x={aparencia.chapeu === 'BONE_LATERAL' ? 15.5 : 3.1} y={aparencia.chapeu === 'BONE_LATERAL' ? 0.4 : 1.4} width="5.4" height="1.6" rx="1" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          )}
        </>
      )}

      {/* óculos */}
      {aparencia.oculos !== 'NENHUM' && (
        <>
          {aparencia.oculos === 'QUADRADO' ? (
            <>
              <rect x="8.1" y="5.5" width="3" height="2.8" rx="0.6" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
              <rect x="12.9" y="5.5" width="3" height="2.8" rx="0.6" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
            </>
          ) : aparencia.oculos === 'ESCUROS' ? (
            <>
              <ellipse cx="9.6" cy="6.8" rx="1.8" ry="1.5" fill={aparencia.corOculos} opacity="0.88" stroke={COR_CONTORNO} strokeWidth="1" />
              <ellipse cx="14.4" cy="6.8" rx="1.8" ry="1.5" fill={aparencia.corOculos} opacity="0.88" stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.oculos === 'MASCARA_MERGULHO' ? (
            <rect x="7.6" y="5.3" width="8.8" height="3.2" rx="1.6" fill={aparencia.corOculos} opacity="0.75" stroke={COR_CONTORNO} strokeWidth="1" />
          ) : aparencia.oculos === 'TAPA_OLHO' ? (
            <circle cx="9.6" cy="6.8" r="1.7" fill={COR_CONTORNO} />
          ) : (
            <>
              <circle cx="9.6" cy="6.8" r="1.7" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
              <circle cx="14.4" cy="6.8" r="1.7" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
            </>
          )}
          <line x1="11.2" y1="6.7" x2="12.8" y2="6.7" stroke={aparencia.corOculos} strokeWidth="1" />
        </>
      )}

      {/* outro */}
      {aparencia.estiloOutro !== 'NENHUM' && (
        <>
          {aparencia.estiloOutro === 'BRINCO' && (
            <>
              <circle cx="6.3" cy="8.6" r="0.55" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.4" />
              <circle cx="17.7" cy="8.6" r="0.55" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.4" />
            </>
          )}
          {aparencia.estiloOutro === 'COLAR' && <circle cx="12" cy="13.5" r="0.7" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.5" />}
          {aparencia.estiloOutro === 'LENCO' && (
            <polygon points="8.5,10.4 15.5,10.4 12,13.6" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.8" />
          )}
          {aparencia.estiloOutro === 'GRAVATA' && (
            <polygon points="10.8,10.6 13.2,10.6 12.8,12.4 12,20 11.2,12.4" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.7" />
          )}
          {aparencia.estiloOutro === 'LACO' && (
            <>
              <polygon points="12,11 9,9.8 9,12.2" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.7" />
              <polygon points="12,11 15,9.8 15,12.2" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.7" />
            </>
          )}
          {aparencia.estiloOutro === 'BROCHE' && (
            <polygon points="12,12.3 12.9,13.6 11.1,13.6" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.6" />
          )}
          {aparencia.estiloOutro === 'MICROFONE' && (
            <rect x="11.4" y="11" width="1.2" height="2.4" rx="0.6" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.5" />
          )}
        </>
      )}

      {/* indicador de status */}
      {corStatus && <circle cx="19.3" cy="19.3" r="2.2" fill={corStatus} stroke="#ffffff" strokeWidth="1.2" />}
    </svg>
  )
}
