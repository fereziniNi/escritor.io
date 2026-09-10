import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { atualizarConfiguracaoRelatorioDiario, buscarConfiguracaoRelatorioDiario, buscarEstadoWhatsApp } from './api'
import type { PreferenciasConteudoRelatorioDiario } from './types'

const PREFERENCIAS_PADRAO: PreferenciasConteudoRelatorioDiario = {
  ponto: true,
  tarefasCriadasMovidas: true,
  tarefasConcluidas: false,
  reunioes: false,
  ausencias: false,
  resumoEquipe: false,
}

/** Pedido do usuário: "adicionar mais informações no relatório diário, mas deixe personalizado
 * para o admin / conseguir visualizar as possibilidades de filtros que poderá utilizar" - um
 * checkbox por bloco, a lista inteira sempre visível (não escondida atrás de "avançado" ou
 * parecido) - é a própria tela que mostra "as possibilidades" que existem pra escolher. */
const BLOCOS_DE_CONTEUDO: { chave: keyof PreferenciasConteudoRelatorioDiario; rotulo: string }[] = [
  { chave: 'ponto', rotulo: 'Ponto (horas trabalhadas)' },
  { chave: 'tarefasCriadasMovidas', rotulo: 'Tarefas criadas/movidas' },
  { chave: 'tarefasConcluidas', rotulo: 'Tarefas concluídas' },
  { chave: 'reunioes', rotulo: 'Reuniões do dia' },
  { chave: 'ausencias', rotulo: 'Quem não bateu ponto (ausências)' },
  { chave: 'resumoEquipe', rotulo: 'Resumo agregado da equipe' },
]

/**
 * Pedido do cliente: "o admin pode escolher a hora do dia para receber um documento sobre o que
 * foi feito no dia pelos funcionarios... todo dia na mesma hora". `<input type="time">` já
 * devolve "HH:mm" - completa com ":00" pro backend (`java.time.LocalTime` espera "HH:mm:ss") e
 * corta de volta pra "HH:mm" ao carregar (`horarioEnvio` vem "HH:mm:ss" do backend).
 */
function ResumoDiarioConfig() {
  const queryClient = useQueryClient()
  const configQuery = useQuery({ queryKey: ['whatsapp', 'relatorio-diario'], queryFn: buscarConfiguracaoRelatorioDiario })
  const [horario, setHorario] = useState('')
  const [habilitado, setHabilitado] = useState(true)
  const [preferencias, setPreferencias] = useState<PreferenciasConteudoRelatorioDiario>(PREFERENCIAS_PADRAO)

  useEffect(() => {
    if (configQuery.data?.configurado && configQuery.data.horarioEnvio) {
      setHorario(configQuery.data.horarioEnvio.slice(0, 5))
      setHabilitado(configQuery.data.habilitado)
    }
    if (configQuery.data?.preferencias) {
      setPreferencias(configQuery.data.preferencias)
    }
  }, [configQuery.data])

  const salvarMutation = useMutation({
    mutationFn: () => atualizarConfiguracaoRelatorioDiario({ horarioEnvio: `${horario}:00`, habilitado, preferencias }),
    onSuccess: (dados) => queryClient.setQueryData(['whatsapp', 'relatorio-diario'], dados),
  })

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">📋 Resumo diário</h2>
      <p className="mensagem-vazia">
        Todo dia, no horário escolhido, o chefe recebe no WhatsApp um resumo do que cada funcionário fez.
      </p>

      {configQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {configQuery.isError && <p className="mensagem-erro">Não foi possível consultar a configuração.</p>}

      {!configQuery.isPending && !configQuery.isError && (
        <form
          className="formulario"
          onSubmit={(evento) => {
            evento.preventDefault()
            salvarMutation.mutate()
          }}
        >
          <div className="campo">
            <label htmlFor="horario-relatorio-diario">Horário de envio</label>
            <input
              id="horario-relatorio-diario"
              type="time"
              value={horario}
              onChange={(evento) => setHorario(evento.target.value)}
              required
            />
          </div>

          <div className="campo campo-acoes" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="habilitado-relatorio-diario">
              <input
                id="habilitado-relatorio-diario"
                type="checkbox"
                checked={habilitado}
                onChange={(evento) => setHabilitado(evento.target.checked)}
              />{' '}
              Habilitado
            </label>
          </div>

          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <span>O que incluir no resumo</span>
            <div className="linha-botoes" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              {BLOCOS_DE_CONTEUDO.map((bloco) => (
                <label key={bloco.chave} htmlFor={`preferencia-${bloco.chave}`}>
                  <input
                    id={`preferencia-${bloco.chave}`}
                    type="checkbox"
                    checked={preferencias[bloco.chave]}
                    onChange={(evento) => setPreferencias((atual) => ({ ...atual, [bloco.chave]: evento.target.checked }))}
                  />{' '}
                  {bloco.rotulo}
                </label>
              ))}
            </div>
          </div>

          <div className="campo-acoes" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="botao-pequeno" disabled={salvarMutation.isPending || !horario}>
              Salvar
            </button>
          </div>
        </form>
      )}

      {salvarMutation.isSuccess && <p className="mensagem-sucesso">✅ Configuração salva.</p>}
      {salvarMutation.isError && <p className="mensagem-erro">Não foi possível salvar a configuração.</p>}
    </section>
  )
}

/**
 * Pedido do cliente: "o codigo QR code poderia ficar na plataforma que voce programou??" - antes
 * o pareamento exigia rodar `curl` na mão (ver DEVELOPMENT.md); agora o admin abre esta tela e vê
 * o QR code direto (backend: `WhatsAppIntegracaoController`/`EvolutionInstanceService`). Só ADMIN
 * chega aqui - o botão que abre este painel já é escondido pro resto (ver `BarraFerramentas`), e o
 * endpoint em si também é `@PreAuthorize("hasRole('ADMIN')")`.
 *
 * `refetchInterval` curto enquanto não conectado: o admin escaneia o QR num celular separado, não
 * tem nenhum evento no navegador pra avisar "conectou" - só descobrir perguntando de novo.
 * Desliga o polling assim que `CONECTADO` (nada mais pra esperar).
 */
export function IntegracaoWhatsAppPage() {
  const estadoQuery = useQuery({
    queryKey: ['whatsapp', 'estado'],
    queryFn: buscarEstadoWhatsApp,
    refetchInterval: (query) => (query.state.data?.situacao === 'CONECTADO' ? false : 3000),
  })

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>📱 WhatsApp</h1>
      </div>

      <section className="secao cartao">
        {estadoQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
        {estadoQuery.isError && <p className="mensagem-erro">Não foi possível consultar o status do WhatsApp.</p>}

        {estadoQuery.data?.situacao === 'CONECTADO' && (
          <p className="mensagem-sucesso">✅ Conectado! Os avisos de ponto (entrada/saída) já estão sendo enviados.</p>
        )}

        {estadoQuery.data?.situacao === 'AGUARDANDO_QRCODE' &&
          (estadoQuery.data.qrCodeBase64 ? (
            <div className="whatsapp-qrcode">
              <p>
                Abra o WhatsApp no celular que vai <strong>enviar</strong> os avisos (não precisa ser o do chefe - ele só
                recebe) → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> e escaneie:
              </p>
              <img src={estadoQuery.data.qrCodeBase64} alt="QR code para conectar o WhatsApp" width={280} height={280} />
              <p className="mensagem-vazia">Atualiza sozinho assim que você escanear - não precisa recarregar a página.</p>
            </div>
          ) : (
            <p className="mensagem-erro">Não foi possível gerar o QR code agora. Tente novamente em instantes.</p>
          ))}

        {estadoQuery.data?.situacao === 'INDISPONIVEL' && (
          <p className="mensagem-erro">{estadoQuery.data.mensagem ?? 'Integração indisponível.'}</p>
        )}
      </section>

      <ResumoDiarioConfig />
    </main>
  )
}
