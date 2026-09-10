import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthStore } from '../auth/authStore'
import { buscarEstadoGoogle } from '../escala/api'
import { ConectarGoogleAgenda } from '../escala/ConectarGoogleAgenda'
import { EscalaEquipePainel } from '../escala/EscalaEquipePainel'
import { MarcarReuniaoComMeetModal } from '../escala/MarcarReuniaoComMeetModal'

/**
 * Pedido do usuário: "Queria que o calendario pessoal de horarios ficasse em uma parte e para
 * agendar as reunioes em outra opcao do sistema" - opção própria na barra de ferramentas. Depois,
 * "quero adicionar de alguma forma integrada ao Google Meet/Calendar... onde o usuário do sistema
 * (independente) vai conseguir marcar e entrar nas reuniões do meet" - deixou de ser GESTOR/ADMIN
 * só (`BarraFerramentas` já abre pra qualquer papel); "➕ Nova reunião" fica disponível pra
 * qualquer um, e exige ter conectado o Google (sem isso não existe link de Meet pra gerar -
 * mesmo aviso do `ConectarGoogleAgenda`, reaproveitado aqui). "👥 Escala da equipe" continua um
 * atalho só de GESTOR/ADMIN (mesmo `EscalaEquipePainel` de sempre - clicar numa célula agora só
 * pré-preenche o modal de marcar reunião).
 */
export function ReunioesPage() {
  const papel = useAuthStore((estado) => estado.papel)
  const [marcarReuniaoAberto, setMarcarReuniaoAberto] = useState(false)
  const estadoGoogleQuery = useQuery({ queryKey: ['google', 'estado'], queryFn: buscarEstadoGoogle })

  const podeMarcarReuniao = estadoGoogleQuery.data?.habilitado && estadoGoogleQuery.data.conectado

  return (
    <div className="pagina">
      {estadoGoogleQuery.data && !podeMarcarReuniao && <ConectarGoogleAgenda />}

      {podeMarcarReuniao && (
        <section className="secao cartao">
          <h2 className="secao-titulo">📹 Marcar reunião</h2>
          <p className="mensagem-vazia">Escolha quem você quer chamar, o horário e ganhe um link de Google Meet na hora.</p>
          <div className="linha-botoes">
            <button type="button" onClick={() => setMarcarReuniaoAberto(true)}>
              ➕ Nova reunião
            </button>
          </div>
        </section>
      )}

      {(papel === 'GESTOR' || papel === 'ADMIN') && <EscalaEquipePainel />}

      {marcarReuniaoAberto && <MarcarReuniaoComMeetModal aoFechar={() => setMarcarReuniaoAberto(false)} />}
    </div>
  )
}
