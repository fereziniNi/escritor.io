import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { PixelCharacterSvg } from '../PixelCharacterSvg'
import {
  APARENCIA_PADRAO,
  CORES_CABELO,
  CORES_PELE,
  CORES_ROUPA,
  OPCOES_CHAPEU,
  OPCOES_ESTILO_CABELO,
  OPCOES_ESTILO_ROUPA,
  OPCOES_OCULOS,
  OPCOES_TIPO_BARBA,
  ROTULO_CHAPEU,
  ROTULO_ESTILO_CABELO,
  ROTULO_ESTILO_ROUPA,
  ROTULO_OCULOS,
  ROTULO_TIPO_BARBA,
} from './aparenciaAvatar'
import type { AparenciaAvatar } from './aparenciaAvatar'
import { atualizarMinhaAparencia, buscarMeuUsuario } from './api'
import './avatar.css'

type Aba = 'base' | 'roupas' | 'acessorios'

/**
 * Editor de personagem - volta a existir depois de uma passagem por sprites prontos (Kenney). O
 * usuário mandou um print do editor de personagem do próprio Gather como referência de composição
 * (abas por categoria, grade de swatches de cor, prévia ao vivo, "Finalizar" salvando no fim) e
 * pediu "voltar ao sistema desenhado à mão, bem mais detalhado". Base ganhou uma 3ª sub-seção
 * (Barba) que não existia na primeira versão - espelha a sub-aba "Facial Hair" da referência.
 * Aberto pela bolha do próprio avatar em `MenuUsuario` (mesmo painel flutuante que todo o resto do
 * dock já usa - `EscritorioPage`/`BarraFerramentas`).
 *
 * O rascunho (`rascunho`) só é aplicado no mundo/nos outros usuários quando "Finalizar" salva de
 * verdade (`PATCH /usuarios/me/aparencia`) - até lá é só local, pra poder experimentar cor/estilo
 * sem afetar ninguém.
 */
export function EditorAvatarPage() {
  const queryClient = useQueryClient()
  const meuUsuarioQuery = useQuery({ queryKey: ['usuarios', 'me'], queryFn: buscarMeuUsuario })
  const [aba, setAba] = useState<Aba>('base')
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
      <div className="editor-avatar-previa" aria-hidden="true">
        <PixelCharacterSvg aparencia={rascunho} direcao="direita" andando={false} destaque={false} />
      </div>

      <div className="editor-avatar-abas" role="tablist" aria-label="Categorias de personalização">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'base'}
          className={`botao-secundario botao-pequeno${aba === 'base' ? ' editor-avatar-aba-ativa' : ''}`}
          onClick={() => setAba('base')}
        >
          Base
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'roupas'}
          className={`botao-secundario botao-pequeno${aba === 'roupas' ? ' editor-avatar-aba-ativa' : ''}`}
          onClick={() => setAba('roupas')}
        >
          Roupas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'acessorios'}
          className={`botao-secundario botao-pequeno${aba === 'acessorios' ? ' editor-avatar-aba-ativa' : ''}`}
          onClick={() => setAba('acessorios')}
        >
          Acessórios
        </button>
      </div>

      {aba === 'base' && (
        <div className="editor-avatar-secao">
          <h3 className="editor-avatar-subtitulo">Pele</h3>
          <SeletorDeCor cores={CORES_PELE} valor={rascunho.corPele} aoEscolher={(cor) => atualizarCampo('corPele', cor)} rotulo="pele" />

          <h3 className="editor-avatar-subtitulo">Cabelo</h3>
          <SeletorDeEstilo
            opcoes={OPCOES_ESTILO_CABELO}
            rotulos={ROTULO_ESTILO_CABELO}
            valor={rascunho.estiloCabelo}
            aoEscolher={(valor) => atualizarCampo('estiloCabelo', valor)}
            rotuloGrupo="Estilo de cabelo"
          />
          <SeletorDeCor cores={CORES_CABELO} valor={rascunho.corCabelo} aoEscolher={(cor) => atualizarCampo('corCabelo', cor)} rotulo="cabelo" />

          <h3 className="editor-avatar-subtitulo">Barba</h3>
          <SeletorDeEstilo
            opcoes={OPCOES_TIPO_BARBA}
            rotulos={ROTULO_TIPO_BARBA}
            valor={rascunho.tipoBarba}
            aoEscolher={(valor) => atualizarCampo('tipoBarba', valor)}
            rotuloGrupo="Barba"
          />
        </div>
      )}

      {aba === 'roupas' && (
        <div className="editor-avatar-secao">
          <h3 className="editor-avatar-subtitulo">Estilo</h3>
          <SeletorDeEstilo
            opcoes={OPCOES_ESTILO_ROUPA}
            rotulos={ROTULO_ESTILO_ROUPA}
            valor={rascunho.estiloRoupa}
            aoEscolher={(valor) => atualizarCampo('estiloRoupa', valor)}
            rotuloGrupo="Estilo de roupa"
          />
          <h3 className="editor-avatar-subtitulo">Cor</h3>
          <SeletorDeCor cores={CORES_ROUPA} valor={rascunho.corRoupa} aoEscolher={(cor) => atualizarCampo('corRoupa', cor)} rotulo="roupa" />
        </div>
      )}

      {aba === 'acessorios' && (
        <div className="editor-avatar-secao">
          <h3 className="editor-avatar-subtitulo">Óculos</h3>
          <SeletorDeEstilo
            opcoes={OPCOES_OCULOS}
            rotulos={ROTULO_OCULOS}
            valor={rascunho.oculos}
            aoEscolher={(valor) => atualizarCampo('oculos', valor)}
            rotuloGrupo="Óculos"
          />
          <h3 className="editor-avatar-subtitulo">Chapéu</h3>
          <SeletorDeEstilo
            opcoes={OPCOES_CHAPEU}
            rotulos={ROTULO_CHAPEU}
            valor={rascunho.chapeu}
            aoEscolher={(valor) => atualizarCampo('chapeu', valor)}
            rotuloGrupo="Chapéu"
          />
        </div>
      )}

      <div className="editor-avatar-rodape">
        <button type="button" className="botao-pequeno" disabled={salvarMutation.isPending} onClick={() => salvarMutation.mutate()}>
          {salvarMutation.isPending ? 'Salvando…' : 'Finalizar'}
        </button>
        {salvarMutation.isError && <p className="mensagem-erro">Não foi possível salvar a aparência.</p>}
        {salvarMutation.isSuccess && <p className="mensagem-sucesso">Aparência salva!</p>}
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

function SeletorDeEstilo<T extends string>({
  opcoes,
  rotulos,
  valor,
  aoEscolher,
  rotuloGrupo,
}: {
  opcoes: T[]
  rotulos: Record<T, string>
  valor: T
  aoEscolher: (opcao: T) => void
  rotuloGrupo: string
}) {
  return (
    <div className="editor-avatar-opcoes" role="group" aria-label={rotuloGrupo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={`botao-secundario botao-pequeno${opcao === valor ? ' editor-avatar-opcao-selecionada' : ''}`}
          aria-pressed={opcao === valor}
          onClick={() => aoEscolher(opcao)}
        >
          {rotulos[opcao]}
        </button>
      ))}
    </div>
  )
}
