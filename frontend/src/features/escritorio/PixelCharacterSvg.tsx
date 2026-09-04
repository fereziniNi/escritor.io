import type { AparenciaAvatar } from './avatar/aparenciaAvatar'

const COR_CONTORNO = '#1c1a28'

/** Mesma geometria de cabeça de `mundo/avatarFactory.ts#CABECA_CX/CY/R` - precisa continuar
 * batendo, os dois desenham o mesmo personagem (esse é o gêmeo SVG). */
const CABECA_CX = 12
const CABECA_CY = 6.4
const CABECA_R = 6

function escurecer(cor: string, fator: number): string {
  const numero = Number(cor.replace('#', '0x'))
  const r = Math.round(((numero >> 16) & 0xff) * (1 - fator))
  const g = Math.round(((numero >> 8) & 0xff) * (1 - fator))
  const b = Math.round((numero & 0xff) * (1 - fator))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Peça de baixo (cintura-tornozelo) - gêmeo SVG de `desenharBottom` em `mundo/avatarFactory.ts`. */
function Bottom({ estilo, cor, x }: { estilo: AparenciaAvatar['estiloBottom']; cor: string; x: number }) {
  switch (estilo) {
    case 'SHORT':
    case 'SHORT_JEANS':
      return <rect x={x - 2} y="0" width="4" height="2.6" rx="1.3" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'SAIA':
      return <polygon points={`${x - 1.3},0 ${x + 1.3},0 ${x + 2.6},4.2 ${x - 2.6},4.2`} fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'SAIA_LONGA':
      return <polygon points={`${x - 1.3},0 ${x + 1.3},0 ${x + 2.9},6.2 ${x - 2.9},6.2`} fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'LEGGING':
      return <rect x={x - 1.5} y="0" width="3" height="6.2" rx="1.4" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    default:
      return <rect x={x - 2} y="0" width="4" height="6.2" rx="1.6" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
  }
}

function Sapato({ estilo, cor, x }: { estilo: AparenciaAvatar['estiloSapato']; cor: string; x: number }) {
  if (estilo === 'DESCALCO') return null
  switch (estilo) {
    case 'BOTA':
      return <rect x={x - 2} y="4.4" width="4" height="3.2" rx="1.4" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'BOTA_CANO_ALTO':
      return <rect x={x - 2} y="2.2" width="4" height="5.4" rx="1.4" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    case 'SALTO':
      return <polygon points={`${x - 2},6.1 ${x + 2},6.1 ${x + 1.2},7.6 ${x - 1.6},7`} fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
    default:
      return <ellipse cx={x} cy="6.7" rx="2.2" ry="1.3" fill={cor} stroke={COR_CONTORNO} strokeWidth="1" />
  }
}

/**
 * Personagem "chibi" desenhado em SVG puro - gêmeo de `AvatarPixi.tsx`/`mundo/avatarFactory.ts`
 * (mesmo viewBox 24×30, mesmas coordenadas/10 camadas). Redesenho (usuário: "o design do boneco
 * atual está extremamente ruim") - cabeça é um círculo de verdade (não mais um retângulo
 * arredondado, que lia como capacete quadrado), cabelo é uma "touca" elíptica cobrindo só a
 * metade de cima da cabeça, pescoço visível conectando à roupa, torso com cantos bem mais
 * arredondados, mangas em cápsula.
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
  const larguraManga = mangaCurta ? 2 : 3.2
  const alturaManga = mangaCurta ? 4.2 : 7.4

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
        <Bottom estilo={aparencia.estiloBottom} cor={aparencia.corBottom} x={0} />
        <Sapato estilo={aparencia.estiloSapato} cor={aparencia.corSapato} x={0} />
      </g>
      <g transform="translate(15,20)">
        <Bottom estilo={aparencia.estiloBottom} cor={aparencia.corBottom} x={0} />
        <Sapato estilo={aparencia.estiloSapato} cor={aparencia.corSapato} x={0} />
      </g>

      {/* top: capuz do moletom leve (atrás do pescoço) */}
      {aparencia.estiloTop === 'MOLETOM_LEVE' && (
        <rect x="7.3" y="11.2" width="9.4" height="3.2" rx="2" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1" />
      )}

      {/* top: mangas (cápsula) + mãos */}
      <rect x="2.2" y="13.6" width={larguraManga} height={alturaManga} rx={larguraManga / 2} fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1" />
      <rect
        x={21.8 - larguraManga}
        y="13.6"
        width={larguraManga}
        height={alturaManga}
        rx={larguraManga / 2}
        fill={aparencia.corTop}
        stroke={COR_CONTORNO}
        strokeWidth="1"
      />
      <circle cx={2.2 + larguraManga / 2} cy={13.6 + alturaManga + 0.6} r="1.15" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="0.8" />
      <circle cx={21.8 - larguraManga / 2} cy={13.6 + alturaManga + 0.6} r="1.15" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="0.8" />

      {/* top: torso (cantos bem arredondados) */}
      <rect x="5.5" y="13" width="13" height="8.5" rx="4.5" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <rect x="7" y="14" width="7" height="3" rx="2" fill="#ffffff" opacity="0.18" />
      <rect x="6.5" y="19" width="11" height="2.2" rx="2" fill="#000000" opacity="0.13" />
      {aparencia.estiloTop === 'GOLA_V' && (
        <polyline points="9.5,13 12,16.5 14.5,13" fill="none" stroke={escurecer(aparencia.corTop, 0.3)} strokeWidth="1" />
      )}
      {(aparencia.estiloTop === 'SUETER' || aparencia.estiloTop === 'GOLA_ALTA') && (
        <rect x="8.7" y="11.5" width="6.6" height="2.4" rx="1.3" fill={aparencia.corTop} stroke={COR_CONTORNO} strokeWidth="1" />
      )}
      {aparencia.estiloTop === 'LISTRADA' &&
        [14.6, 16.5, 18.4, 20.3].map((y) => <rect key={y} x="5.5" y={y} width="13" height="0.6" fill={escurecer(aparencia.corTop, 0.25)} opacity="0.55" />)}

      {/* jaqueta (opcional, por cima do top) */}
      {aparencia.estiloJaqueta !== 'NENHUMA' && (
        <>
          <rect x="4" y="12.6" width="6.2" height="10.6" rx="3" fill={aparencia.corJaqueta} stroke={COR_CONTORNO} strokeWidth="1.2" />
          <rect x="13.8" y="12.6" width="6.2" height="10.6" rx="3" fill={aparencia.corJaqueta} stroke={COR_CONTORNO} strokeWidth="1.2" />
          <rect x="4.6" y="13.2" width="2.8" height="2.6" rx="1.4" fill="#ffffff" opacity="0.16" />
        </>
      )}

      {/* corpo base: pescoço + cabeça (círculo) */}
      <rect x="9.8" y="11.4" width="4.4" height="2.6" rx="1.3" fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="1" />
      <circle cx={CABECA_CX} cy={CABECA_CY} r={CABECA_R} fill={aparencia.corPele} stroke={COR_CONTORNO} strokeWidth="1.2" />
      <circle cx={CABECA_CX + 2.4} cy={CABECA_CY + 2.6} r="3.4" fill="#000000" opacity="0.1" />
      <circle cx={CABECA_CX - 2.4} cy={CABECA_CY - 3} r="2.9" fill="#ffffff" opacity="0.24" />
      <circle cx="9.3" cy="8.5" r="1.1" fill="#ffffff" opacity="0.2" />
      <circle cx="9.4" cy="7.3" r="1.05" fill={COR_CONTORNO} />
      <circle cx="14.6" cy="7.3" r="1.05" fill={COR_CONTORNO} />
      <circle cx="9.7" cy="6.9" r="0.38" fill="#ffffff" />
      <circle cx="14.9" cy="6.9" r="0.38" fill="#ffffff" />

      {/* barba */}
      {(aparencia.tipoBarba === 'BIGODE_FINO' || aparencia.tipoBarba === 'CAVANHAQUE_BIGODE') && (
        <rect x="10.3" y="9" width="3.4" height="0.7" rx="0.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.5" />
      )}
      {aparencia.tipoBarba === 'BIGODE_GROSSO' && (
        <rect x="10" y="8.9" width="4" height="1.1" rx="0.55" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.6" />
      )}
      {(aparencia.tipoBarba === 'CAVANHAQUE' || aparencia.tipoBarba === 'CAVANHAQUE_BIGODE') && (
        <rect x="10.6" y="10.2" width="2.8" height="2" rx="1" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
      )}
      {aparencia.tipoBarba === 'SUICAS' && (
        <>
          <rect x="5.6" y="6.4" width="1.5" height="3.4" rx="0.75" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.7" />
          <rect x="16.9" y="6.4" width="1.5" height="3.4" rx="0.75" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.7" />
        </>
      )}
      {aparencia.tipoBarba === 'BARBA_CURTA' && (
        <ellipse cx="12" cy="10.6" rx="4.3" ry="1.6" fill={aparencia.corCabelo} opacity="0.85" stroke={COR_CONTORNO} strokeWidth="0.8" />
      )}
      {aparencia.tipoBarba === 'BARBA_CHEIA' && (
        <ellipse cx="12" cy="10.8" rx="4.7" ry="1.9" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
      )}

      {/* cabelo */}
      {aparencia.estiloCabelo === 'RASPADO' && (
        <ellipse cx="12" cy="0.9" rx="6.2" ry="1.4" fill={aparencia.corCabelo} opacity="0.7" stroke={COR_CONTORNO} strokeWidth="0.8" />
      )}
      {aparencia.estiloCabelo === 'MOICANO' && (
        <rect x="10.4" y="-2.3" width="3.2" height="5.4" rx="1.5" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
      )}
      {aparencia.estiloCabelo === 'ESPETADO' &&
        [6.2, 9.1, 12, 14.9, 17.8].map((x) => (
          <polygon key={x} points={`${x - 1.5},3.2 ${x},-3.2 ${x + 1.5},3.2`} fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.8" />
        ))}
      {aparencia.estiloCabelo === 'CACHEADO' && (
        <>
          <ellipse cx="12" cy="2" rx="6.4" ry="2.6" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
          {[
            [7.2, 0.9],
            [9.7, -0.4],
            [12, -0.9],
            [14.3, -0.4],
            [16.8, 0.9],
          ].map(([cx, cy]) => (
            <circle key={cx} cx={cx} cy={cy} r="1.7" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="0.9" />
          ))}
        </>
      )}
      {aparencia.estiloCabelo !== 'CARECA' &&
        aparencia.estiloCabelo !== 'RASPADO' &&
        aparencia.estiloCabelo !== 'MOICANO' &&
        aparencia.estiloCabelo !== 'ESPETADO' &&
        aparencia.estiloCabelo !== 'CACHEADO' && (
          <>
            <ellipse cx="12" cy="2.6" rx="6.6" ry="4.3" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            <rect x="6.6" y="-0.7" width="5.6" height="1.5" rx="1" fill="#ffffff" opacity="0.14" />
            {aparencia.estiloCabelo === 'REPARTIDO' && (
              <line x1="9.2" y1="-0.8" x2="10.6" y2="3.4" stroke={escurecer(aparencia.corCabelo, 0.35)} strokeWidth="0.6" />
            )}
            {aparencia.estiloCabelo === 'RABO_DE_CAVALO' && (
              <rect x="10.4" y="5" width="3.2" height="7" rx="1.6" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
            )}
            {aparencia.estiloCabelo === 'CHIQUINHAS' && (
              <>
                <circle cx="4.7" cy="4" r="2" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
                <circle cx="19.3" cy="4" r="2" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              </>
            )}
            {aparencia.estiloCabelo === 'LONGO' && (
              <>
                <rect x="4.3" y="3.2" width="2.7" height="6" rx="1.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
                <rect x="17" y="3.2" width="2.7" height="6" rx="1.35" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
                <rect x="4.3" y="8.6" width="2.5" height="7" rx="1.25" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
                <rect x="17.2" y="8.6" width="2.5" height="7" rx="1.25" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />
              </>
            )}
            {aparencia.estiloCabelo === 'COQUE' && <circle cx="12" cy="-2.5" r="2.2" fill={aparencia.corCabelo} stroke={COR_CONTORNO} strokeWidth="1" />}
          </>
        )}

      {/* chapéu */}
      {aparencia.chapeu !== 'NENHUM' && (
        <>
          {aparencia.chapeu === 'GORRO' ? (
            <>
              <rect x="5" y="-3.6" width="14" height="6" rx="4" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <circle cx="12" cy="-4.2" r="1.4" fill="#ffffff" stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.chapeu === 'CARTOLA' ? (
            <>
              <rect x="7" y="-6.8" width="10" height="5" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="5" y="-2.4" width="14" height="1.3" rx="0.6" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.chapeu === 'CAPACETE' ? (
            <circle cx="12" cy="4.4" r="7.3" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1.2" />
          ) : aparencia.chapeu === 'CHAPEU_PRAIA' ? (
            <>
              <ellipse cx="12" cy="-1.3" rx="9.2" ry="2.2" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect x="7.2" y="-4" width="9.6" height="3" rx="2" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.chapeu === 'FAIXA' || aparencia.chapeu === 'TIARA' ? (
            <rect
              x="5.3"
              y={aparencia.chapeu === 'TIARA' ? -1.4 : -1.1}
              width="13.4"
              height={aparencia.chapeu === 'TIARA' ? 1 : 1.6}
              rx="0.6"
              fill={aparencia.corChapeu}
              stroke={COR_CONTORNO}
              strokeWidth="0.8"
            />
          ) : aparencia.chapeu === 'BANDANA' ? (
            <rect x="5.3" y="-2.5" width="13.4" height="3" rx="1.5" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
          ) : (
            <>
              <rect x="5.3" y="-3" width="13.4" height="4.4" rx="3" fill={aparencia.corChapeu} stroke={COR_CONTORNO} strokeWidth="1" />
              <rect
                x={aparencia.chapeu === 'BONE_LATERAL' ? 15.5 : 3.1}
                y={aparencia.chapeu === 'BONE_LATERAL' ? -1.7 : -0.7}
                width="5.4"
                height="1.6"
                rx="1"
                fill={aparencia.corChapeu}
                stroke={COR_CONTORNO}
                strokeWidth="1"
              />
            </>
          )}
        </>
      )}

      {/* óculos */}
      {aparencia.oculos !== 'NENHUM' && (
        <>
          {aparencia.oculos === 'QUADRADO' ? (
            <>
              <rect x="7.9" y="6" width="3" height="2.8" rx="0.6" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
              <rect x="13.1" y="6" width="3" height="2.8" rx="0.6" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
            </>
          ) : aparencia.oculos === 'ESCUROS' ? (
            <>
              <ellipse cx="9.4" cy="7.3" rx="1.8" ry="1.5" fill={aparencia.corOculos} opacity="0.88" stroke={COR_CONTORNO} strokeWidth="1" />
              <ellipse cx="14.6" cy="7.3" rx="1.8" ry="1.5" fill={aparencia.corOculos} opacity="0.88" stroke={COR_CONTORNO} strokeWidth="1" />
            </>
          ) : aparencia.oculos === 'MASCARA_MERGULHO' ? (
            <rect x="7.4" y="5.8" width="9.2" height="3.2" rx="1.6" fill={aparencia.corOculos} opacity="0.75" stroke={COR_CONTORNO} strokeWidth="1" />
          ) : aparencia.oculos === 'TAPA_OLHO' ? (
            <circle cx="9.4" cy="7.3" r="1.7" fill={COR_CONTORNO} />
          ) : (
            <>
              <circle cx="9.4" cy="7.3" r="1.7" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
              <circle cx="14.6" cy="7.3" r="1.7" fill="none" stroke={aparencia.corOculos} strokeWidth="1" />
            </>
          )}
          <line x1="11" y1="7.2" x2="13" y2="7.2" stroke={aparencia.corOculos} strokeWidth="1" />
        </>
      )}

      {/* outro */}
      {aparencia.estiloOutro !== 'NENHUM' && (
        <>
          {aparencia.estiloOutro === 'BRINCO' && (
            <>
              <circle cx="6" cy="8" r="0.55" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.4" />
              <circle cx="18" cy="8" r="0.55" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.4" />
            </>
          )}
          {aparencia.estiloOutro === 'COLAR' && <circle cx="12" cy="15.3" r="0.7" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.5" />}
          {aparencia.estiloOutro === 'LENCO' && (
            <polygon points="8.5,12.4 15.5,12.4 12,15.6" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.8" />
          )}
          {aparencia.estiloOutro === 'GRAVATA' && (
            <polygon points="10.8,12.6 13.2,12.6 12.8,14.4 12,21 11.2,14.4" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.7" />
          )}
          {aparencia.estiloOutro === 'LACO' && (
            <>
              <polygon points="12,13 9,11.8 9,14.2" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.7" />
              <polygon points="12,13 15,11.8 15,14.2" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.7" />
            </>
          )}
          {aparencia.estiloOutro === 'BROCHE' && (
            <polygon points="12,14.3 12.9,15.6 11.1,15.6" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.6" />
          )}
          {aparencia.estiloOutro === 'MICROFONE' && (
            <rect x="11.4" y="13" width="1.2" height="2.4" rx="0.6" fill={aparencia.corOutro} stroke={COR_CONTORNO} strokeWidth="0.5" />
          )}
        </>
      )}

      {/* indicador de status */}
      {corStatus && <circle cx="19.3" cy="19.3" r="2.2" fill={corStatus} stroke="#ffffff" strokeWidth="1.2" />}
    </svg>
  )
}
