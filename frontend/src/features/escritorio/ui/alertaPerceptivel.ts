/**
 * Pedido do usuário: "sempre que alguém finalizar uma tarefa, receba uma mensagem, receba o
 * convite de uma reunião... notificado ao usuário... reproduzir algum barulho e exibir algo para
 * o usuário perceber, seja na aba do navegador" - confirmado com o usuário: piscar o título da
 * aba (sempre funciona) + notificação nativa do sistema operacional (pede permissão uma vez).
 * Chamado pelos efeitos de `EscritorioPage.tsx` que já processam os eventos em tempo real
 * (convite de reunião, mensagem de chat, tarefa concluída) - não decide QUANDO notificar, só COMO.
 *
 * Pedido posterior do usuário: "a aba mostrasse a quantidade de notificações que não foram lidas"
 * - `atualizarContadorNaoLidas` prefixa o título com "(N)" (mesmo padrão do Gmail/qualquer caixa
 * de entrada), sempre visível (não só quando a aba está oculta, diferente do piscar abaixo).
 */

const TITULO_ORIGINAL = typeof document !== 'undefined' ? document.title : ''
const INTERVALO_PISCAR_MS = 1000
let intervaloPiscando: ReturnType<typeof setInterval> | null = null
let listenerDeVisibilidadeRegistrado = false
let contadorNaoLidas = 0

/** Título "de repouso" da aba - o original, ou com o prefixo "(N)" quando há não lidas. É pra
 * onde `piscarTituloDaAba` restaura ao ficar visível de novo, e o que `atualizarContadorNaoLidas`
 * aplica direto quando não há piscar em andamento no momento. */
function tituloComContador(): string {
  return contadorNaoLidas > 0 ? `(${contadorNaoLidas}) ${TITULO_ORIGINAL}` : TITULO_ORIGINAL
}

/** Beep curto via Web Audio API - sem depender de nenhum arquivo de áudio externo. Envelope de
 * ganho (sobe rápido, desce suave) pra não estalar; silencioso (`catch`) se o navegador bloquear
 * áudio sem interação prévia do usuário (autoplay policy) - a notificação visual continua
 * funcionando de qualquer forma. */
export function tocarSom() {
  try {
    const AudioContextClasse = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClasse) {
      return
    }
    const contexto = new AudioContextClasse()
    const osc = contexto.createOscillator()
    const ganho = contexto.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    ganho.gain.setValueAtTime(0.0001, contexto.currentTime)
    ganho.gain.exponentialRampToValueAtTime(0.2, contexto.currentTime + 0.02)
    ganho.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.22)
    osc.connect(ganho)
    ganho.connect(contexto.destination)
    osc.start()
    osc.stop(contexto.currentTime + 0.25)
    osc.onended = () => contexto.close().catch(() => {})
  } catch {
    // navegador sem suporte, ou bloqueou por autoplay policy - sem som, sem quebrar nada.
  }
}

/** Chamada uma vez, ao montar `EscritorioPage` - `Notification.requestPermission()` já é
 * idempotente sozinho (não reabre o prompt se a pessoa já concedeu ou negou antes), mas guardamos
 * atrás de um `typeof` porque nem todo navegador/contexto (ex.: iframe sem permissão) tem a API. */
export function pedirPermissaoDeNotificacao() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') {
    return
  }
  Notification.requestPermission().catch(() => {})
}

/** Só dispara o popup do sistema operacional se a permissão já foi concedida E a aba está oculta
 * - um popup do SO por cima de uma aba que a pessoa já está olhando é redundante (o toast/badge
 * dentro do próprio app já cobre isso). */
export function notificarNoSistema(titulo: string, corpo: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) {
    return
  }
  try {
    new Notification(titulo, { body: corpo, icon: '/favicon.svg' })
  } catch {
    // alguns navegadores restringem `new Notification` fora de um Service Worker em certos
    // contextos - sem popup do SO, mas o título piscando e o som continuam.
  }
}

/** Só ativa enquanto a aba está oculta - pisca `document.title` alternando com `mensagem` a cada
 * `INTERVALO_PISCAR_MS`; um único listener de `visibilitychange` (registrado uma vez, não por
 * chamada) para o intervalo e restaura o título original assim que a pessoa volta pra aba. */
export function piscarTituloDaAba(mensagem: string) {
  if (!document.hidden) {
    return
  }
  if (!listenerDeVisibilidadeRegistrado) {
    listenerDeVisibilidadeRegistrado = true
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && intervaloPiscando) {
        clearInterval(intervaloPiscando)
        intervaloPiscando = null
        document.title = tituloComContador()
      }
    })
  }
  if (intervaloPiscando) {
    clearInterval(intervaloPiscando)
  }
  let mostrandoAlerta = true
  document.title = mensagem
  intervaloPiscando = setInterval(() => {
    mostrandoAlerta = !mostrandoAlerta
    document.title = mostrandoAlerta ? mensagem : tituloComContador()
  }, INTERVALO_PISCAR_MS)
}

/** Pedido do usuário: "a aba mostrasse a quantidade de notificações que não foram lidas" - chamado
 * pela `EscritorioPage` toda vez que `GET /notificacoes` traz um `naoLidas` novo. Sempre visível
 * (diferente de `piscarTituloDaAba`, que só age com a aba oculta); enquanto um piscar estiver em
 * andamento, só entra em vigor quando ele parar - uma única fonte de verdade por vez em
 * `document.title`. */
export function atualizarContadorNaoLidas(quantidade: number) {
  contadorNaoLidas = quantidade
  if (!intervaloPiscando) {
    document.title = tituloComContador()
  }
}

/** Ponto de entrada único usado pelos efeitos de `EscritorioPage` - som sempre, aviso na aba
 * (piscando o título) e notificação nativa só quando a pessoa não está olhando a aba agora. */
export function alertar({ titulo, corpo }: { titulo: string; corpo: string }) {
  tocarSom()
  piscarTituloDaAba(`🔔 ${titulo}`)
  notificarNoSistema(titulo, corpo)
}
