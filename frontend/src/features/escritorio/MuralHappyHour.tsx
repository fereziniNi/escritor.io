/**
 * Pedido do usuário: "quando a pessoa entra [na sala Happy Hour] aparece um modal pequeno escrito
 * 'mural'. Se ela clica no mural aparece algumas opções" - cartão pequeno e fixo (não um toast que
 * some sozinho, `useNotificacoes` dura só 4s - fácil demais de perder andando pelo mapa), mesmo
 * espírito de `CronometroTarefaAtiva.tsx`: só existe enquanto `dentroDaZona` for verdadeiro
 * (`EscritorioPage` calcula isso a partir da posição do próprio jogador + `zonaContendo`), some
 * sozinho ao sair da sala. Clicar abre o painel cheio.
 *
 * Pedido do usuário (depois de ver a 1ª versão, um pill liso igual aos outros widgets do HUD):
 * "gostaria que o botão do mural fosse diferente. Me surpreenda" - vira um bilhete de verdade,
 * como se alguém tivesse corrido até o mapa e colado um post-it torto no mundo: rotacionado, com
 * uma tira de fita crepe por cima (`::before`, ver CSS) e letra manuscrita (`--fonte-manuscrita`).
 * Endireita e levanta um pouco só no `:hover` (CSS puro, sem `setInterval`/animação contínua -
 * uma pulsação infinita já causou um problema real de precisão de clique nesta mesma tela, ver
 * histórico do `EscritorioPage.css`).
 */
export function MuralHappyHour({ dentroDaZona, aoClicar }: { dentroDaZona: boolean; aoClicar: () => void }) {
  if (!dentroDaZona) {
    return null
  }

  return (
    <button type="button" className="escritorio-mural-happy-hour" onClick={aoClicar} aria-label="Mural do Happy Hour, clique para abrir">
      <span className="escritorio-mural-happy-hour-titulo">🎉 Mural</span>
      <span className="escritorio-mural-happy-hour-dica">toque pra abrir ✌️</span>
    </button>
  )
}
