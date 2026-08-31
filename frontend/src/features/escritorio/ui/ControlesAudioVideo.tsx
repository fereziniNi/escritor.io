/**
 * Botões de mic/câmera/compartilhar tela existem visualmente no HUD (fidelidade com o dock do
 * Gather) mas não funcionam de verdade - decisão explícita do usuário nesta sessão: sem WebRTC,
 * sem signaling, sem chamada real. `aria-disabled` + tooltip "Em breve" é um estado não-funcional
 * honesto (o botão não finge fazer algo que não faz), em vez de um clique morto sem explicação.
 */
export function ControlesAudioVideo() {
  return (
    <div className="escritorio-toolbar-grupo" role="group" aria-label="Áudio e vídeo (em breve)">
      <button type="button" className="escritorio-toolbar-botao" aria-disabled="true" title="Microfone - em breve">
        🎤
      </button>
      <button type="button" className="escritorio-toolbar-botao" aria-disabled="true" title="Câmera - em breve">
        📷
      </button>
      <button type="button" className="escritorio-toolbar-botao" aria-disabled="true" title="Compartilhar tela - em breve">
        🖥️
      </button>
    </div>
  )
}
