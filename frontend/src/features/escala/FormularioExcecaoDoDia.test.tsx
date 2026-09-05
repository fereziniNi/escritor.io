import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormularioExcecaoDoDia } from './FormularioExcecaoDoDia'

function renderFormulario(propsParciais: Partial<Parameters<typeof FormularioExcecaoDoDia>[0]> = {}) {
  const aoSalvar = vi.fn()
  const aoRemover = vi.fn()
  const aoFechar = vi.fn()
  render(
    <FormularioExcecaoDoDia
      data="2026-09-01"
      trabalhaInicial={false}
      horaInicioInicial={null}
      horaFimInicial={null}
      excecaoExistenteId={null}
      salvando={false}
      removendo={false}
      erro={false}
      aoSalvar={aoSalvar}
      aoRemover={aoRemover}
      aoFechar={aoFechar}
      {...propsParciais}
    />,
  )
  return { aoSalvar, aoRemover, aoFechar }
}

describe('FormularioExcecaoDoDia', () => {
  it('marcar "trabalho nesse dia" sem horário prévio nenhum mostra 09:00-18:00 como padrão, não vazio', async () => {
    // regressão: `horaCurta(null) ?? '09:00'` nunca caía no fallback porque `horaCurta` devolve
    // string vazia, não null/undefined - o campo ficava "--:--" (vazio) em vez de um horário
    // padrão sensato, pego na verificação visual (Playwright) desta sessão.
    const user = userEvent.setup()
    renderFormulario({ trabalhaInicial: false, horaInicioInicial: null, horaFimInicial: null })

    await user.click(screen.getByLabelText(/trabalho nesse dia/i))

    expect((screen.getByLabelText(/^início$/i) as HTMLInputElement).value).toBe('09:00')
    expect((screen.getByLabelText(/^fim$/i) as HTMLInputElement).value).toBe('18:00')
  })

  it('com horário sugerido (arraste na grade), usa o horário arrastado em vez do padrão', () => {
    renderFormulario({ horaInicioSugerida: '10:30', horaFimSugerida: '12:00', trabalhaInicial: false })

    expect((screen.getByLabelText(/^início$/i) as HTMLInputElement).value).toBe('10:30')
    expect((screen.getByLabelText(/^fim$/i) as HTMLInputElement).value).toBe('12:00')
  })

  it('com horário efetivo já existente, prefila com ele', () => {
    renderFormulario({ trabalhaInicial: true, horaInicioInicial: '08:00:00', horaFimInicial: '17:00:00' })

    expect((screen.getByLabelText(/^início$/i) as HTMLInputElement).value).toBe('08:00')
    expect((screen.getByLabelText(/^fim$/i) as HTMLInputElement).value).toBe('17:00')
  })

  it('salvar como dia de folga (desmarcado) manda trabalha=false e horários nulos', async () => {
    const user = userEvent.setup()
    const { aoSalvar } = renderFormulario({ trabalhaInicial: false })

    await user.click(screen.getByRole('button', { name: /salvar/i }))

    expect(aoSalvar).toHaveBeenCalledWith({ data: '2026-09-01', trabalha: false, horaInicio: null, horaFim: null, observacao: null })
  })

  it('só mostra "Remover exceção" quando já existe uma exceção salva pra essa data', () => {
    renderFormulario({ excecaoExistenteId: null })
    expect(screen.queryByRole('button', { name: /remover exceção/i })).not.toBeInTheDocument()

    renderFormulario({ excecaoExistenteId: 42 })
    expect(screen.getByRole('button', { name: /remover exceção/i })).toBeInTheDocument()
  })

  it('prefila a observação salva anteriormente', () => {
    renderFormulario({ observacaoInicial: 'Plantão de fim de semana' })

    expect(screen.getByLabelText(/observação/i)).toHaveValue('Plantão de fim de semana')
  })
})
