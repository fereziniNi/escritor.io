import './skills.css'

/** Link discreto de volta para a tela anterior (o primeiro elemento de todas as subtelas). */
export function BotaoVoltar({ aoVoltar, rotulo = 'Voltar às skills' }: { aoVoltar: () => void; rotulo?: string }) {
  return (
    <button type="button" className="skills-voltar" onClick={aoVoltar}>
      <span aria-hidden="true">←</span>
      {rotulo}
    </button>
  )
}
