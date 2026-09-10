/**
 * Pedido do usuário: "Tem como tirar o botão de notificação do menu e deixar na parte
 * superior??? Mas eu não quero que fique o botão! Inove" - saiu da toolbar (mesmo espírito de
 * `MuralHappyHour.tsx`: "gostaria que o botão do mural fosse diferente. Me surpreenda", que virou
 * um bilhete de verdade em vez de mais um pill quadrado). Primeira versão virou um sininho redondo
 * discreto pendurado por um cordão - o usuário mandou o print de volta: "Gostaria que a
 * notificação tivesse um botão diferente e notável que seja de notificação. Não somente esse botão
 * dessa forma" - trocado por uma medalha hexagonal (não mais um círculo liso), com o rótulo
 * "Notificações" escrito por baixo pra nunca deixar dúvida do que é, mesmo discreta em repouso.
 *
 * Sempre alcançável (histórico continua acessível a qualquer momento, mesmo sem nada novo), mas
 * com dois estados bem diferentes: discreta (bronze, pequena) quando não há nada novo, e "tocando"
 * (maior, dourada, com brilho e a etiqueta de contagem) assim que chega alguma notificação. A troca
 * de estado usa `key` pra remontar o elemento e disparar de novo a animação de balanço - sem loop
 * contínuo (lição real desta mesma tela: uma pulsação infinita no mural deixava o clique impreciso,
 * ver `EscritorioPage.css`) - toca uma vez e se acomoda.
 */
export function SinoDeNotificacoes({ naoLidas, aberto, aoClicar }: { naoLidas: number; aberto: boolean; aoClicar: () => void }) {
  const temNaoLidas = naoLidas > 0

  return (
    <button
      type="button"
      key={temNaoLidas ? `tocando-${naoLidas}` : 'quieto'}
      className={`escritorio-sino${temNaoLidas ? ' escritorio-sino--tocando' : ''}${aberto ? ' escritorio-sino--aberto' : ''}`}
      onClick={aoClicar}
      aria-label={temNaoLidas ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
      title="Notificações"
    >
      <span className="escritorio-sino-medalha" aria-hidden="true">
        <span className="escritorio-sino-icone">🔔</span>
        {temNaoLidas && <span className="escritorio-sino-contador">{naoLidas > 9 ? '9+' : naoLidas}</span>}
      </span>
      <span className="escritorio-sino-rotulo">Notificações</span>
    </button>
  )
}
