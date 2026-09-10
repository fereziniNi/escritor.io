import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HealthStatus } from '../../app/HealthStatus'
import { useAuthStore } from '../auth/authStore'
import { ChatMiniWidget } from '../chat/ChatMiniWidget'
import type { Mensagem } from '../chat/types'
import { IntegracaoWhatsAppPage } from '../integracoes/IntegracaoWhatsAppPage'
import { ColaboradoresPage } from '../organizacao/ColaboradoresPage'
import { RelatoriosPage } from '../relatorios/RelatoriosPage'
import { HappyHourPainel } from '../happyhour/HappyHourPainel'
import { buscarNotificacoes, marcarNotificacoesComoLidas } from '../notificacoes/api'
import { NotificacoesPainel } from '../notificacoes/NotificacoesPainel'
import { buscarMapaAtivo } from './api'
import { APARENCIA_PADRAO } from './avatar/aparenciaAvatar'
import { ConfiguracoesPessoaisPage } from './ConfiguracoesPessoaisPage'
import { ReunioesPage } from './ReunioesPage'
import './EscritorioPage.css'
import './ui/hud.css'
import { CronometroTarefaAtiva } from './CronometroTarefaAtiva'
import { CronometroTrabalho } from './CronometroTrabalho'
import { MuralHappyHour } from './MuralHappyHour'
import { SinoDeNotificacoes } from './SinoDeNotificacoes'
import { CamadaMundo } from './mundo/CamadaMundo'
import { PROXIMIDADE_RAIO_TILES } from './mundo/constantes'
import { construirBloqueioDeCapacidade } from './mundo/construirBloqueioDeCapacidade'
import { construirGradeColisao } from './mundo/construirGradeColisao'
import { BORDA_PORTA_POR_TIPO } from './mundo/dadosMundo'
import { gerarParedesDeZona } from './mundo/gerarParedesDeZona'
import { zonaContendo } from './mundo/localizarZona'
import type { PosicaoTile } from './mundo/movimento'
import { calcularParesDeVoz, calcularParesProximos } from './mundo/proximidade'
import { calcularDestinoParaStatus } from './mundo/statusParaZona'
import { useMovimentoTeclado } from './mundo/useMovimentoTeclado'
import { useVozProximidade } from './mundo/useVozProximidade'
import { PainelFlutuante } from './PainelFlutuante'
import { PainelPonto } from './PainelPonto'
import { PainelProjetos } from './PainelProjetos'
import type { StatusAvatar } from './types'
import { alertar, atualizarContadorNaoLidas, pedirPermissaoDeNotificacao } from './ui/alertaPerceptivel'
import type { PainelId } from './ui/BarraFerramentas'
import { BarraFerramentas } from './ui/BarraFerramentas'
import { Notificacoes } from './ui/Notificacao'
import { useNotificacoes } from './ui/useNotificacoes'
import { usePresencaWebSocket } from './usePresencaWebSocket'

const TITULO_PAINEL: Record<PainelId, string> = {
  ponto: '⏱️ Ponto',
  configuracoes: '⚙️ Configurações pessoais',
  reunioes: '🤝 Reuniões',
  relatorios: '📊 Relatórios',
  projetos: '📁 Projetos',
  colaboradores: '🧑‍💼 Colaboradores',
  whatsapp: '📱 WhatsApp',
  happyHour: '🎉 Happy Hour',
  notificacoes: '🔔 Notificações',
}

/**
 * O mundo (piso/móveis/avatares/câmera) é desenhado num canvas Pixi via `CamadaMundo` (redesign
 * estilo Gather, ver plano em `.claude/plans/splendid-percolating-mochi.md`). Sem paredes/colisão
 * de propósito (pedido do usuário: "remover as paredes, deixar o mapa mais vivo") - o movimento
 * só é limitado pelos cantos do mapa (`useMovimentoTeclado`). O HUD ao redor virou uma toolbar
 * inferior (`BarraFerramentas`) + uma pilha de notificações (`Notificacoes`) - mais perto da
 * proporção e do comportamento do dock/painel do Gather do que a barra sempre-visível de antes.
 * Pedido do usuário: "Remova a parte de quem está no escritório" - o drawer de participantes
 * (lista de presença por zona) que existia aqui foi removido.
 */
export function EscritorioPage() {
  const queryClient = useQueryClient()
  const mapaQuery = useQuery({ queryKey: ['mapas', 'ativo'], queryFn: buscarMapaAtivo })
  const {
    usuarios,
    meuUsuarioId,
    mover,
    definirStatus,
    convitesRecebidos,
    mensagensRecebidas,
    tarefasConcluidasRecebidas,
    novasTarefasRecebidas,
    sorteiosHappyHourRecebidos,
    sinaisRtcRecebidos,
    enviarSinalRtc,
  } = usePresencaWebSocket()
  const papel = useAuthStore((estado) => estado.papel)
  const [painelAberto, setPainelAberto] = useState<PainelId | null>(null)
  // Pedido do usuário: "se eu clicar nele [no cronômetro da tarefa] abre o modal dessa atividade" -
  // guarda qual projeto/card abrir quando o widget `CronometroTarefaAtiva` é clicado; passado como
  // `selecaoInicial` pra `PainelProjetos` (a chave força remontar se a pessoa clicar de novo numa
  // OUTRA tarefa ativa enquanto o painel de Projetos já está aberto).
  const [selecaoProjeto, setSelecaoProjeto] = useState<{ projetoId: number; cardId: number } | null>(null)
  // Some assim que a pessoa sai do painel de Projetos (fecha ou troca de painel) - senão reabrir
  // "Projetos" pela barra de ferramentas (não pelo widget) voltaria direto pro último card em vez
  // de mostrar a lista.
  useEffect(() => {
    if (painelAberto !== 'projetos') {
      setSelecaoProjeto(null)
    }
  }, [painelAberto])
  // Pedido do usuário: "Esse agenda pessoal deve estar em configurações pessoais, ali a pessoa
  // pode editar até o personagem também" - "Configurações pessoais" tem duas abas (Personagem/
  // Minha escala); qual delas abre depende de COMO o painel foi aberto (barra de ferramentas vs.
  // clicar na própria bolha de avatar) - por isso essa aba fica aqui, não dentro do componente da
  // página (cada abertura é uma montagem nova, então o valor vira o estado inicial da aba lá).
  const [abaConfiguracoes, setAbaConfiguracoes] = useState<'personagem' | 'escala'>('escala')
  const { itens: notificacoes, notificar } = useNotificacoes()

  // Pedido do usuário: "algo relacionado à notificação para ver as últimas que chegaram no
  // sistema" - histórico persistente (sobrevive a F5/logout), diferente do `useNotificacoes`
  // acima (toast passageiro, só em memória da aba). `refetchInterval` cobre o contador do sino
  // mesmo com o painel fechado; os 4 efeitos de "itens novos" abaixo também invalidam essa query
  // pra o contador reagir na hora, sem esperar os 30s.
  const notificacoesQuery = useQuery({ queryKey: ['notificacoes'], queryFn: buscarNotificacoes, refetchInterval: 30000 })
  const marcarNotificacoesComoLidasMutation = useMutation({
    mutationFn: marcarNotificacoesComoLidas,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificacoes'] }),
  })
  // Mesma UX de inbox comum - abrir a central já marca tudo como lido.
  useEffect(() => {
    if (painelAberto === 'notificacoes' && (notificacoesQuery.data?.naoLidas ?? 0) > 0) {
      marcarNotificacoesComoLidasMutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painelAberto])
  // Pedido do usuário: "a aba mostrasse a quantidade de notificações que não foram lidas" -
  // prefixo "(N)" no título, sempre visível (não só quando a aba está em segundo plano).
  useEffect(() => {
    atualizarContadorNaoLidas(notificacoesQuery.data?.naoLidas ?? 0)
  }, [notificacoesQuery.data?.naoLidas])

  // Pedido do usuário: "algo muito parecido com o agenda do google... ou ate mesmo integrar" - a
  // Google redireciona o navegador de volta pra cá (`IntegracaoGoogleController#callback`, no
  // backend, devolve `/?google=conectado|erro`) depois do usuário autorizar. Lê o parâmetro uma
  // vez ao montar, mostra o toast, abre "Configurações pessoais" na aba "Minha escala" (é lá que a
  // conexão foi iniciada) e limpa a URL - sem isso o parâmetro reapareceria num F5 e notificaria
  // de novo.
  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    const google = parametros.get('google')
    if (google === 'conectado') {
      notificar('✅ Google Agenda conectado!')
      setAbaConfiguracoes('escala')
      setPainelAberto('configuracoes')
    } else if (google === 'erro') {
      notificar('Não foi possível conectar ao Google Agenda.')
      setAbaConfiguracoes('escala')
      setPainelAberto('configuracoes')
    }
    if (google !== null) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pedido do usuário: "notificações... reproduzir algum barulho e exibir algo para o usuário
  // perceber, seja na aba do navegador" - a notificação nativa do sistema operacional
  // (`alertaPerceptivel.ts`) precisa de permissão do navegador; pede uma vez ao entrar no
  // escritório (a própria API já é idempotente - não reabre o prompt se a pessoa já respondeu).
  useEffect(() => {
    pedirPermissaoDeNotificacao()
  }, [])

  const eu = meuUsuarioId !== null ? usuarios[meuUsuarioId] : undefined

  // Pedido do usuário: "coloque parede em todas [as áreas]" - colisão client-side em toda sala
  // (mesma fonte de paredes que CamadaMundo usa pra desenhar, `gerarParedesDeZona` +
  // `BORDA_PORTA_POR_TIPO`). Limitação real e documentada: o servidor (ValidadorPosicaoMapa)
  // continua só validando o retângulo externo do mapa, não as paredes de cada sala.
  const zonas = mapaQuery.data?.zonas ?? []
  const cabines = useMemo(() => zonas.filter((zona) => zona.tipo === 'CABINE'), [zonas])
  const paredes = useMemo(() => gerarParedesDeZona(zonas, (zona) => BORDA_PORTA_POR_TIPO[zona.tipo]), [zonas])
  const bloqueadaPelaParede = useMemo(() => construirGradeColisao(paredes), [paredes])
  // Pedido do usuário: "Apenas uma pessoa deve entrar na cabine, Capacidade de 1 pessoa por
  // cabine" - além da parede (estática, só muda se o mapa mudar), bloqueia também a porta de uma
  // cabine que já tem gente (dinâmico - recalcula a cada posição nova de qualquer usuário).
  const bloqueadaPelaCapacidade = useMemo(
    () => construirBloqueioDeCapacidade(cabines, Object.values(usuarios), meuUsuarioId),
    [cabines, usuarios, meuUsuarioId],
  )
  const transicaoBloqueada = useMemo(
    () => (de: PosicaoTile, para: PosicaoTile) => bloqueadaPelaParede(de, para) || bloqueadaPelaCapacidade(de, para),
    [bloqueadaPelaParede, bloqueadaPelaCapacidade],
  )

  useMovimentoTeclado({
    // com um painel aberto (formulário, board etc.), as setas são do painel, não do personagem
    ativo: painelAberto === null,
    posicaoAtual: eu ? { x: eu.x, y: eu.y } : undefined,
    limites: { larguraTiles: mapaQuery.data?.larguraTiles ?? 1, alturaTiles: mapaQuery.data?.alturaTiles ?? 1 },
    mover,
    transicaoBloqueada,
  })

  // proximidade (Fase 3): calculada a partir da posição real em tile, não de posição de tela -
  // usada pro brilho no mundo Pixi (dentro de CamadaMundo, que recalcula por conta própria a
  // partir dos mesmos `usuarios`) e pro toast abaixo.
  const usuariosLista = useMemo(() => Object.values(usuarios), [usuarios])
  const pares = useMemo(() => calcularParesProximos(usuariosLista, PROXIMIDADE_RAIO_TILES), [usuariosLista])

  // Pedido do usuário: "voice, onde podemos falar dentro da sala... ou com a pessoa mais
  // próxima... Implemente da melhor maneira possível" - une as duas regras (`calcularParesDeVoz`)
  // em vez do raio puro de `pares` acima (que só serve pro destaque/toast visual). Mic é opt-in
  // (`micAtivo`, botão da toolbar) - `useVozProximidade` só pede `getUserMedia`/abre conexão
  // WebRTC enquanto estiver ligado.
  const [micAtivo, setMicAtivo] = useState(false)
  const paresDeVoz = useMemo(
    () => calcularParesDeVoz(usuariosLista, PROXIMIDADE_RAIO_TILES, mapaQuery.data?.zonas ?? []),
    [usuariosLista, mapaQuery.data],
  )
  const { falando } = useVozProximidade({
    meuUsuarioId,
    ativo: micAtivo,
    paresDeVoz,
    sinaisRtcRecebidos,
    enviarSinalRtc,
  })

  // notifica só a *transição* de entrar em proximidade de alguém (não fica repetindo a cada
  // render enquanto os dois continuam parados perto um do outro).
  const paresNotificadosRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (meuUsuarioId === null) {
      return
    }
    const chaves = new Set<string>()
    for (const par of pares) {
      const chave = `${par.usuarioIdA}-${par.usuarioIdB}`
      chaves.add(chave)
      const souEuNoPar = par.usuarioIdA === meuUsuarioId || par.usuarioIdB === meuUsuarioId
      if (souEuNoPar && !paresNotificadosRef.current.has(chave)) {
        const outroId = par.usuarioIdA === meuUsuarioId ? par.usuarioIdB : par.usuarioIdA
        const outro = usuarios[outroId]
        if (outro) {
          notificar(`${outro.nome} está por perto`)
        }
      }
    }
    paresNotificadosRef.current = chaves
  }, [pares, meuUsuarioId, usuarios, notificar])

  // Pedido do usuário: "chamar para reunião pela plataforma" - avisa em tempo real quando alguém
  // te chama pra uma reunião (só dispara pros itens NOVOS desde a última vez, mesma técnica de
  // "notifica só a transição" usada acima pra proximidade - sem isso repetiria o toast a cada
  // render). O botão de ação abre o Meet direto, sem precisar navegar até "Reuniões".
  const convitesProcessadosRef = useRef(0)
  useEffect(() => {
    const novos = convitesRecebidos.slice(convitesProcessadosRef.current)
    for (const convite of novos) {
      notificar(
        `📹 ${convite.criadorNome} te chamou pra "${convite.titulo}" agora`,
        convite.linkMeet ? { rotulo: 'Entrar no Meet', aoClicar: () => window.open(convite.linkMeet!, '_blank') } : undefined,
      )
      alertar({ titulo: 'Convite de reunião', corpo: `${convite.criadorNome} te chamou pra "${convite.titulo}"` })
    }
    if (novos.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    }
    convitesProcessadosRef.current = convitesRecebidos.length
  }, [convitesRecebidos, notificar, queryClient])

  // Pedido do usuário: "chat... em tempo real, as mensagens devem enviar e receber no mesmo
  // momento que são enviadas. Não deve conter atraso" - mesma técnica de "só processa itens
  // novos" usada acima pros convites de reunião. Atualiza a thread já aberta em cache (se a
  // pessoa já abriu essa conversa antes - `setQueryData` não cria uma entrada nova do zero, pra
  // não fixar um cache incompleto pra uma conversa nunca carregada) e invalida `['chat',
  // 'conversas']`, que o `ChatMiniWidget` (sempre montado, canto superior esquerdo) usa pra lista
  // de conversas/contador de não lidas - ele reage sozinho, nada mais é feito aqui além do
  // `alertar` (som + aba); sem toast novo, o badge do widget já é o aviso visual dentro do app.
  const mensagensProcessadasRef = useRef(0)
  useEffect(() => {
    const novas = mensagensRecebidas.slice(mensagensProcessadasRef.current)
    for (const mensagem of novas) {
      const cacheAtual = queryClient.getQueryData<Mensagem[]>(['chat', 'mensagens', mensagem.conversaId])
      if (cacheAtual) {
        queryClient.setQueryData<Mensagem[]>(['chat', 'mensagens', mensagem.conversaId], [
          ...cacheAtual,
          {
            id: mensagem.mensagemId,
            conversaId: mensagem.conversaId,
            autorId: mensagem.autorId,
            autorNome: mensagem.autorNome,
            texto: mensagem.texto,
            criadoEm: mensagem.criadoEm,
          },
        ])
      }
      alertar({ titulo: `Mensagem de ${mensagem.autorNome}`, corpo: mensagem.texto })
    }
    if (novas.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
    }
    mensagensProcessadasRef.current = mensagensRecebidas.length
  }, [mensagensRecebidas, queryClient])

  // Pedido do usuário: "sempre que alguém finalizar uma tarefa... notificado ao usuário" - mesma
  // técnica de "só processa itens novos" dos outros dois efeitos. Além do toast/alerta passageiro,
  // agora também vira uma linha persistente na central de notificações (🔔) - pedido posterior do
  // usuário: "ver as últimas que chegaram no sistema" (ver `notificacaoService.registrar` no
  // backend, chamado ao lado do `avisarTarefaConcluida`).
  const tarefasProcessadasRef = useRef(0)
  useEffect(() => {
    const novas = tarefasConcluidasRecebidas.slice(tarefasProcessadasRef.current)
    for (const tarefa of novas) {
      notificar(`✅ ${tarefa.autorNome} concluiu "${tarefa.cardTitulo}" em ${tarefa.projetoNome}`)
      alertar({ titulo: 'Tarefa concluída', corpo: `${tarefa.autorNome} concluiu "${tarefa.cardTitulo}" em ${tarefa.projetoNome}` })
    }
    if (novas.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    }
    tarefasProcessadasRef.current = tarefasConcluidasRecebidas.length
  }, [tarefasConcluidasRecebidas, notificar, queryClient])

  // Pedido do usuário: "quando qualquer pessoa adicionar alguma tarefa nova independente de qual
  // projeto que seja, deve informar todos os usuários do sistema... e em qual projeto foi" - mesma
  // técnica de "só processa itens novos" dos outros efeitos; broadcast (todo mundo conectado
  // exceto quem criou, ver `usePresencaWebSocket`), não uma lista de destinatários específicos
  // como a de tarefa concluída.
  const novasTarefasProcessadasRef = useRef(0)
  useEffect(() => {
    const novas = novasTarefasRecebidas.slice(novasTarefasProcessadasRef.current)
    for (const tarefa of novas) {
      notificar(`📋 ${tarefa.autorNome} criou a tarefa "${tarefa.cardTitulo}" em ${tarefa.projetoNome}`)
      alertar({ titulo: 'Nova tarefa', corpo: `${tarefa.autorNome} criou "${tarefa.cardTitulo}" em ${tarefa.projetoNome}` })
    }
    if (novas.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    }
    novasTarefasProcessadasRef.current = novasTarefasRecebidas.length
  }, [novasTarefasRecebidas, notificar, queryClient])

  // Pedido do usuário: "uma parte para roleta onde será sorteado qual atividade será feita" - o
  // resultado é o "momento" compartilhado de todo mundo, por isso o toast/alerta vale mesmo sem o
  // painel do Happy Hour aberto. Invalida (não escreve direto) as duas queries do módulo - o
  // evento do WS só carrega o essencial pro toast (`descricao`), a refetch busca o registro
  // completo certinho pra quem tiver o painel aberto (`HappyHourPainel`/`RoletaSecao` reagem
  // sozinhos) e corrige o badge "🎉 Escolhida" na lista de atividades.
  const sorteiosProcessadosRef = useRef(0)
  useEffect(() => {
    const novos = sorteiosHappyHourRecebidos.slice(sorteiosProcessadosRef.current)
    for (const sorteio of novos) {
      notificar(`🎉 Roleta girou! Atividade escolhida: "${sorteio.descricao}"`)
      alertar({ titulo: 'Happy Hour', corpo: `${sorteio.sorteadoPorNome} girou a roleta: "${sorteio.descricao}"` })
    }
    if (novos.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['happy-hour', 'sorteio'] })
      queryClient.invalidateQueries({ queryKey: ['happy-hour', 'atividades'] })
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    }
    sorteiosProcessadosRef.current = sorteiosHappyHourRecebidos.length
  }, [sorteiosHappyHourRecebidos, notificar, queryClient])

  if (mapaQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (mapaQuery.isError) {
    return <p>Não foi possível carregar o mapa.</p>
  }

  const mapa = mapaQuery.data
  const meuStatus = eu?.status ?? 'DISPONIVEL'
  // Pedido do usuário: "quando a pessoa entra [na sala Happy Hour] aparece um modal pequeno" -
  // 100% client-side, a partir da posição já disponível (`eu`) + zonas já carregadas (`mapa`).
  const zonaAtual = eu ? zonaContendo(mapa.zonas, eu.x, eu.y) : null

  // pedido do usuário: escolher um status redireciona o personagem pro lugar que o representa
  // (Área de trabalho/Sala de reunião/Café/Fora do trabalho) - `calcularDestinoParaStatus` decide
  // se existe destino (DISPONIVEL não tem, de propósito).
  function aoMudarStatus(status: StatusAvatar) {
    definirStatus(status)
    const destino = calcularDestinoParaStatus(mapa.zonas, status)
    if (destino) {
      mover(destino.x, destino.y)
    }
  }

  // Pedido do usuário (sessão anterior): "onde está o link da reunião para eu entrar? Preciso
  // entrar no google?" - reaproveita o mecanismo que já existe pro status "Reunião": muda o status
  // e teleporta o personagem pra Sala de Reunião do mapa (a presença no escritório virtual, além
  // da videochamada de verdade no Meet), fechando o painel pra a pessoa já ver o próprio
  // personagem lá. Passado até `EscalaCalendarioPainel` (o botão "Entrar na sala do escritório"
  // fica no detalhe de uma reunião já marcada).
  function entrarNaReuniao() {
    aoMudarStatus('REUNIAO')
    setPainelAberto(null)
  }

  // Clicar na própria bolha de avatar (`MenuUsuario`) abre "Configurações pessoais" direto na aba
  // Personagem - diferente do botão da barra de ferramentas, que abre na aba Minha escala (ação
  // mais comum no dia a dia).
  function abrirEditorDePersonagem() {
    setAbaConfiguracoes('personagem')
    setPainelAberto('configuracoes')
  }

  return (
    <section className="escritorio-pagina">
      <div className="escritorio-canto-superior-direito">
        <CronometroTrabalho />
        <CronometroTarefaAtiva
          aoClicar={(cronometro) => {
            setSelecaoProjeto({ projetoId: cronometro.projetoId, cardId: cronometro.cardId })
            setPainelAberto('projetos')
          }}
        />
      </div>
      {/* Pedido do usuário: "um mini chat aberto na lateral esquerda no topo, igual ao tempo mas
          do lado esquerdo... igual ao whats, mas em miniatura igual um popup" - sempre montado
          (não é mais uma opção do menu, nem depende de mensagem não lida pra existir). */}
      <div className="escritorio-canto-superior-esquerdo">
        <ChatMiniWidget meuUsuarioId={meuUsuarioId} />
        {/* Pedido do usuário: "Deixe a notificação do lado do chat" - ver `SinoDeNotificacoes.tsx`
            pro histórico completo de como esse widget chegou até essa forma/posição. */}
        <SinoDeNotificacoes
          naoLidas={notificacoesQuery.data?.naoLidas ?? 0}
          aberto={painelAberto === 'notificacoes'}
          aoClicar={() => setPainelAberto('notificacoes')}
        />
      </div>
      <Notificacoes itens={notificacoes} />
      <MuralHappyHour dentroDaZona={zonaAtual?.tipo === 'HAPPY_HOUR'} aoClicar={() => setPainelAberto('happyHour')} />

      <BarraFerramentas
        nome={eu?.nome ?? 'Você'}
        meuAparencia={eu?.aparencia ?? APARENCIA_PADRAO}
        meuStatus={meuStatus}
        aoMudarStatus={aoMudarStatus}
        papel={papel}
        painelAberto={painelAberto}
        aoAbrirPainel={setPainelAberto}
        aoAbrirEditorAvatar={abrirEditorDePersonagem}
        micAtivo={micAtivo}
        aoAlternarMic={() => setMicAtivo((atual) => !atual)}
      />

      {painelAberto && (
        <PainelFlutuante
          titulo={TITULO_PAINEL[painelAberto]}
          aoFechar={() => setPainelAberto(null)}
          largo={painelAberto === 'projetos' || painelAberto === 'reunioes'}
        >
          {painelAberto === 'ponto' && <PainelPonto />}
          {painelAberto === 'configuracoes' && (
            <ConfiguracoesPessoaisPage abaInicial={abaConfiguracoes} aoEntrarNaReuniao={entrarNaReuniao} />
          )}
          {painelAberto === 'reunioes' && <ReunioesPage />}
          {painelAberto === 'relatorios' && <RelatoriosPage />}
          {painelAberto === 'projetos' && (
            <PainelProjetos
              key={selecaoProjeto ? `${selecaoProjeto.projetoId}-${selecaoProjeto.cardId}` : 'lista'}
              selecaoInicial={selecaoProjeto ?? undefined}
            />
          )}
          {painelAberto === 'colaboradores' && <ColaboradoresPage />}
          {painelAberto === 'whatsapp' && <IntegracaoWhatsAppPage />}
          {painelAberto === 'happyHour' && <HappyHourPainel />}
          {painelAberto === 'notificacoes' && <NotificacoesPainel itens={notificacoesQuery.data?.itens ?? []} />}
        </PainelFlutuante>
      )}

      <div className="escritorio-layout">
        <div className="escritorio-coluna-mapa">
          <CamadaMundo
            larguraTiles={mapa.larguraTiles}
            alturaTiles={mapa.alturaTiles}
            zonas={mapa.zonas}
            usuarios={usuariosLista}
            meuUsuarioId={meuUsuarioId}
            falando={falando}
          />
          {/* Pedido do usuário: "após entrar, a tela do mapa (apenas do mapa) fica mais escura,
              como se tivesse em modo off" - só essa div escurece (irmã do canvas, dentro de
              `.escritorio-coluna-mapa`); toolbar/painéis/chat/sino ficam de fora por estarem fora
              deste container. `zonaAtual` já existia (calculado acima pro mural do Happy Hour). */}
          {zonaAtual?.tipo === 'CABINE' && (
            <div className="escritorio-mapa-escurecido" aria-hidden="true" data-testid="mapa-escurecido" />
          )}
        </div>
      </div>

      <div className="escritorio-rodape">
        <HealthStatus />
      </div>
    </section>
  )
}
