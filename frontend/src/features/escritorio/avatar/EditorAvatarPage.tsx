import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { PersonagemPreview } from './PersonagemPreview'
import {
  APARENCIA_PADRAO,
  CORES_CABELO,
  CORES_GERAL,
  CORES_PELE,
  OPCOES_CHAPEU,
  OPCOES_ESTILO_BOTTOM,
  OPCOES_ESTILO_CABELO,
  OPCOES_ESTILO_JAQUETA,
  OPCOES_ESTILO_OUTRO,
  OPCOES_ESTILO_SAPATO,
  OPCOES_ESTILO_TOP,
  OPCOES_OCULOS,
  OPCOES_TIPO_BARBA,
  OPCOES_TIPO_ROSTO,
  ROTULO_CHAPEU,
  ROTULO_ESTILO_BOTTOM,
  ROTULO_ESTILO_CABELO,
  ROTULO_ESTILO_JAQUETA,
  ROTULO_ESTILO_OUTRO,
  ROTULO_ESTILO_SAPATO,
  ROTULO_ESTILO_TOP,
  ROTULO_OCULOS,
  ROTULO_TIPO_BARBA,
  ROTULO_TIPO_ROSTO,
} from './aparenciaAvatar'
import type { AparenciaAvatar } from './aparenciaAvatar'
import { atualizarMinhaAparencia, buscarMeuUsuario } from './api'
import './avatar.css'

type Categoria = 'skin' | 'face' | 'hair' | 'facialHair' | 'top' | 'jacket' | 'bottom' | 'shoes' | 'hat' | 'glasses' | 'other'

const CATEGORIAS: { id: Categoria; rotulo: string }[] = [
  { id: 'skin', rotulo: 'Skin' },
  { id: 'face', rotulo: 'Face' },
  { id: 'hair', rotulo: 'Hair' },
  { id: 'facialHair', rotulo: 'Facial hair' },
  { id: 'top', rotulo: 'Top' },
  { id: 'jacket', rotulo: 'Jacket' },
  { id: 'bottom', rotulo: 'Bottom' },
  { id: 'shoes', rotulo: 'Shoes' },
  { id: 'hat', rotulo: 'Hat' },
  { id: 'glasses', rotulo: 'Glasses' },
  { id: 'other', rotulo: 'Other' },
]

/**
 * Editor de personagem - estrutura e quantidade de categorias espelham o editor do Gather (mandado
 * como referência pelo usuário: "faça exatamente igual... todas as opções de partes devem possuir
 * mais do que a tela esta mostrando"), arte 100% original ("nada de arte roubada/baixada do
 * Gather", regra já estabelecida nesta sessão). Layout de 3 colunas igual à referência: nav
 * vertical com as 11 categorias, grade de miniaturas + paleta de cor no meio, prévia grande à
 * direita. Cada miniatura mostra o personagem inteiro com aquela opção aplicada (não só a peça
 * isolada) - simplificação deliberada, o "clique pra ver o efeito de verdade no personagem" já
 * cumpre o mesmo papel sem precisar de um segundo conjunto de componentes de desenho só pra ícone.
 * "Face" (formato do rosto/cabeça) não existe no Gather - pedido do usuário depois da virada pra
 * pixel art real (LPC): "quero poder escolher qual face irei utilizar". Sem paleta de cor própria
 * (reaproveita `corPele`, mesmo padrão de "Facial hair" com `corCabelo`).
 *
 * O rascunho (`rascunho`) só é aplicado no mundo/nos outros usuários quando "Finalizar" salva de
 * verdade (`PATCH /usuarios/me/aparencia`) - até lá é só local.
 */
export function EditorAvatarPage() {
  const queryClient = useQueryClient()
  const meuUsuarioQuery = useQuery({ queryKey: ['usuarios', 'me'], queryFn: buscarMeuUsuario })
  const [categoria, setCategoria] = useState<Categoria>('skin')
  const [rascunho, setRascunho] = useState<AparenciaAvatar>(APARENCIA_PADRAO)
  const [rascunhoInicializado, setRascunhoInicializado] = useState(false)

  useEffect(() => {
    if (meuUsuarioQuery.data && !rascunhoInicializado) {
      setRascunho(meuUsuarioQuery.data.aparencia)
      setRascunhoInicializado(true)
    }
  }, [meuUsuarioQuery.data, rascunhoInicializado])

  const salvarMutation = useMutation({
    mutationFn: () => atualizarMinhaAparencia(rascunho),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'me'] })
    },
  })

  function atualizarCampo<K extends keyof AparenciaAvatar>(campo: K, valor: AparenciaAvatar[K]) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
  }

  if (meuUsuarioQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (meuUsuarioQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar seu avatar.</p>
  }

  return (
    <div className="editor-avatar">
      <nav className="editor-avatar-nav" aria-label="Categorias de personalização">
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`editor-avatar-nav-item${categoria === c.id ? ' editor-avatar-nav-item-ativo' : ''}`}
            aria-current={categoria === c.id}
            onClick={() => setCategoria(c.id)}
          >
            {c.rotulo}
          </button>
        ))}
      </nav>

      <div className="editor-avatar-conteudo">
        {categoria === 'skin' && <SeletorDeCor cores={CORES_PELE} valor={rascunho.corPele} aoEscolher={(cor) => atualizarCampo('corPele', cor)} rotulo="pele" />}

        {categoria === 'face' && (
          <GradeDeEstilo
            opcoes={OPCOES_TIPO_ROSTO}
            rotulos={ROTULO_TIPO_ROSTO}
            valor={rascunho.tipoRosto}
            aoEscolher={(v) => atualizarCampo('tipoRosto', v)}
            montarPreview={(v) => ({ ...rascunho, tipoRosto: v })}
          />
        )}

        {categoria === 'hair' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_ESTILO_CABELO}
              rotulos={ROTULO_ESTILO_CABELO}
              valor={rascunho.estiloCabelo}
              aoEscolher={(v) => atualizarCampo('estiloCabelo', v)}
              montarPreview={(v) => ({ ...rascunho, estiloCabelo: v })}
            />
            <SeletorDeCor cores={CORES_CABELO} valor={rascunho.corCabelo} aoEscolher={(cor) => atualizarCampo('corCabelo', cor)} rotulo="cabelo" />
          </>
        )}

        {categoria === 'facialHair' && (
          <GradeDeEstilo
            opcoes={OPCOES_TIPO_BARBA}
            rotulos={ROTULO_TIPO_BARBA}
            valor={rascunho.tipoBarba}
            aoEscolher={(v) => atualizarCampo('tipoBarba', v)}
            montarPreview={(v) => ({ ...rascunho, tipoBarba: v })}
          />
        )}

        {categoria === 'top' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_ESTILO_TOP}
              rotulos={ROTULO_ESTILO_TOP}
              valor={rascunho.estiloTop}
              aoEscolher={(v) => atualizarCampo('estiloTop', v)}
              montarPreview={(v) => ({ ...rascunho, estiloTop: v })}
            />
            <SeletorDeCor cores={CORES_GERAL} valor={rascunho.corTop} aoEscolher={(cor) => atualizarCampo('corTop', cor)} rotulo="top" />
          </>
        )}

        {categoria === 'jacket' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_ESTILO_JAQUETA}
              rotulos={ROTULO_ESTILO_JAQUETA}
              valor={rascunho.estiloJaqueta}
              aoEscolher={(v) => atualizarCampo('estiloJaqueta', v)}
              montarPreview={(v) => ({ ...rascunho, estiloJaqueta: v })}
            />
            <SeletorDeCor cores={CORES_GERAL} valor={rascunho.corJaqueta} aoEscolher={(cor) => atualizarCampo('corJaqueta', cor)} rotulo="jaqueta" />
          </>
        )}

        {categoria === 'bottom' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_ESTILO_BOTTOM}
              rotulos={ROTULO_ESTILO_BOTTOM}
              valor={rascunho.estiloBottom}
              aoEscolher={(v) => atualizarCampo('estiloBottom', v)}
              montarPreview={(v) => ({ ...rascunho, estiloBottom: v })}
            />
            <SeletorDeCor cores={CORES_GERAL} valor={rascunho.corBottom} aoEscolher={(cor) => atualizarCampo('corBottom', cor)} rotulo="bottom" />
          </>
        )}

        {categoria === 'shoes' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_ESTILO_SAPATO}
              rotulos={ROTULO_ESTILO_SAPATO}
              valor={rascunho.estiloSapato}
              aoEscolher={(v) => atualizarCampo('estiloSapato', v)}
              montarPreview={(v) => ({ ...rascunho, estiloSapato: v })}
            />
            <SeletorDeCor cores={CORES_GERAL} valor={rascunho.corSapato} aoEscolher={(cor) => atualizarCampo('corSapato', cor)} rotulo="sapato" />
          </>
        )}

        {categoria === 'hat' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_CHAPEU}
              rotulos={ROTULO_CHAPEU}
              valor={rascunho.chapeu}
              aoEscolher={(v) => atualizarCampo('chapeu', v)}
              montarPreview={(v) => ({ ...rascunho, chapeu: v })}
            />
            <SeletorDeCor cores={CORES_GERAL} valor={rascunho.corChapeu} aoEscolher={(cor) => atualizarCampo('corChapeu', cor)} rotulo="chapéu" />
          </>
        )}

        {categoria === 'glasses' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_OCULOS}
              rotulos={ROTULO_OCULOS}
              valor={rascunho.oculos}
              aoEscolher={(v) => atualizarCampo('oculos', v)}
              montarPreview={(v) => ({ ...rascunho, oculos: v })}
            />
            <SeletorDeCor cores={CORES_GERAL} valor={rascunho.corOculos} aoEscolher={(cor) => atualizarCampo('corOculos', cor)} rotulo="óculos" />
          </>
        )}

        {categoria === 'other' && (
          <>
            <GradeDeEstilo
              opcoes={OPCOES_ESTILO_OUTRO}
              rotulos={ROTULO_ESTILO_OUTRO}
              valor={rascunho.estiloOutro}
              aoEscolher={(v) => atualizarCampo('estiloOutro', v)}
              montarPreview={(v) => ({ ...rascunho, estiloOutro: v })}
            />
            <SeletorDeCor cores={CORES_GERAL} valor={rascunho.corOutro} aoEscolher={(cor) => atualizarCampo('corOutro', cor)} rotulo="outro" />
          </>
        )}
      </div>

      <div className="editor-avatar-previa-coluna">
        <div className="editor-avatar-previa" aria-hidden="true">
          <PersonagemPreview aparencia={rascunho} direcao="direita" andando={false} destaque={false} />
        </div>
        <button type="button" className="botao-pequeno" disabled={salvarMutation.isPending} onClick={() => salvarMutation.mutate()}>
          {salvarMutation.isPending ? 'Salvando…' : 'Finalizar'}
        </button>
        {salvarMutation.isError && <p className="mensagem-erro">Não foi possível salvar a aparência.</p>}
        {salvarMutation.isSuccess && <p className="mensagem-sucesso">Aparência salva!</p>}
        {/* Pixel art do personagem vem do projeto LPC (licença OGA-BY 3.0 - só exige crédito
            "razoavelmente descobrível", ver frontend/public/personagem-lpc/CREDITS.md) - este link
            é esse crédito dentro do próprio app, não só um arquivo perdido no repositório. */}
        <a className="editor-avatar-creditos" href="/personagem-lpc/CREDITS.md" target="_blank" rel="noreferrer">
          Créditos da arte do personagem
        </a>
      </div>
    </div>
  )
}

function SeletorDeCor({
  cores,
  valor,
  aoEscolher,
  rotulo,
}: {
  cores: string[]
  valor: string
  aoEscolher: (cor: string) => void
  rotulo: string
}) {
  return (
    <div className="editor-avatar-swatches" role="group" aria-label={`Cor de ${rotulo}`}>
      {cores.map((cor) => (
        <button
          key={cor}
          type="button"
          className={`editor-avatar-swatch${cor === valor ? ' editor-avatar-swatch-selecionado' : ''}`}
          style={{ backgroundColor: cor }}
          aria-label={`Cor ${cor}`}
          aria-pressed={cor === valor}
          onClick={() => aoEscolher(cor)}
        />
      ))}
    </div>
  )
}

function GradeDeEstilo<T extends string>({
  opcoes,
  rotulos,
  valor,
  aoEscolher,
  montarPreview,
}: {
  opcoes: T[]
  rotulos: Record<T, string>
  valor: T
  aoEscolher: (opcao: T) => void
  montarPreview: (opcao: T) => AparenciaAvatar
}) {
  return (
    <div className="editor-avatar-grade" role="group" aria-label="Estilo">
      {opcoes.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={`editor-avatar-opcao${opcao === valor ? ' editor-avatar-opcao-selecionada' : ''}`}
          aria-pressed={opcao === valor}
          onClick={() => aoEscolher(opcao)}
          title={rotulos[opcao]}
        >
          <PersonagemPreview aparencia={montarPreview(opcao)} direcao="direita" andando={false} destaque={false} />
          <span>{rotulos[opcao]}</span>
        </button>
      ))}
    </div>
  )
}
