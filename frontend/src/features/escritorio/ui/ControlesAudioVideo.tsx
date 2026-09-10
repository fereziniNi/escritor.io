/**
 * Botão de mic no HUD. Câmera e compartilhar tela saíram daqui por pedido do usuário ("Deixe so o
 * microfone e tire os outros dois do lado dele") - continuam fora de escopo (decisão anterior:
 * "sem WebRTC, sem signaling, sem chamada real" pra elas). O microfone liga/desliga voz por
 * proximidade de verdade (WebRTC, `mundo/useVozProximidade.ts`), acionado por `EscritorioPage`.
 */
export function ControlesAudioVideo({ micAtivo, aoAlternarMic }: { micAtivo: boolean; aoAlternarMic: () => void }) {
  return (
    <div className="escritorio-toolbar-grupo" role="group" aria-label="Áudio">
      <button
        type="button"
        className={`escritorio-toolbar-botao${micAtivo ? ' escritorio-toolbar-botao--ativo' : ''}`}
        aria-label={micAtivo ? 'Desativar microfone' : 'Ativar microfone'}
        aria-pressed={micAtivo}
        title={micAtivo ? 'Microfone ativado - voz por proximidade' : 'Ativar microfone (voz por proximidade)'}
        onClick={aoAlternarMic}
      >
        {micAtivo ? '🎤' : '🔇'}
      </button>
    </div>
  )
}
