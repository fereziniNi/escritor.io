// origem: skills-modelo/apps/web/src/App.tsx
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Papel, ROTULO_PAPEL } from 'contratos';
import { Activity, LayoutDashboard, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Navigate, Outlet, RouterProvider, createBrowserRouter, useNavigate } from 'react-router';
import { AppShell, type GrupoMenu } from '@/componentes/AppShell';
import { Carregando, ErroCarregar } from '@/componentes/estados';
import { ErroApi, buscarSaude } from '@/lib/api';
import { buscarEu, sair } from '@/lib/auth-api';
import { Inicio } from '@/telas/Inicio';
import { TelaAuditoria } from '@/telas/TelaAuditoria';
import { TelaEntrar } from '@/telas/TelaEntrar';
import { TelaFormulario } from '@/telas/modelo/TelaFormulario';
import { TelaListagem } from '@/telas/modelo/TelaListagem';
import { TelaPainel } from '@/telas/modelo/TelaPainel';
import { TelaUsuarios } from '@/telas/TelaUsuarios';

/** Quem está logado (GET /api/auth/eu). */
const CHAVE_EU = ['auth', 'eu'] as const;

/** Sessão vencida no meio do uso (401 em qualquer chamada): relê /api/auth/eu, e o Layout manda para /entrar. */
const aoErro = (erro: unknown) => {
  if (erro instanceof ErroApi && erro.status === 401) void clienteConsultas.invalidateQueries({ queryKey: CHAVE_EU });
};

const clienteConsultas: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: aoErro }),
  mutationCache: new MutationCache({ onError: aoErro }),
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const NOME_SISTEMA = 'Sistema';

/** Menu por papel. Esconder um item não é segurança (a API recusa com 403); só evita mostrar o que não abre. */
function gruposDo(papel: Papel): GrupoMenu[] {
  const grupos: GrupoMenu[] = [
    {
      titulo: 'Operação',
      itens: [
        { rotulo: 'Painel', para: '/', icone: <LayoutDashboard className="size-4" /> },
        { rotulo: 'Cedentes', para: '/cedentes', icone: <Users className="size-4" /> },
      ],
    },
  ];
  if (papel === 'ADMIN') {
    grupos.push({
      titulo: 'Admin',
      itens: [
        { rotulo: 'Usuários', para: '/usuarios', icone: <ShieldCheck className="size-4" /> },
        { rotulo: 'Auditoria', para: '/admin/auditoria', icone: <ScrollText className="size-4" /> },
        { rotulo: 'Estado do sistema', para: '/sistema', icone: <Activity className="size-4" /> },
      ],
    });
  }
  return grupos;
}

/** Telas logadas: sem sessão vai para /entrar; com sessão, sidebar com o usuário que a API informa. */
function Layout() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const eu = useQuery({ queryKey: CHAVE_EU, queryFn: buscarEu });
  const saude = useQuery({ queryKey: ['saude'], queryFn: buscarSaude, enabled: Boolean(eu.data) });
  const [erroSair, setErroSair] = useState<string | null>(null);

  if (eu.isPending) return <Carregando />;
  if (eu.isError) return <ErroCarregar mensagem={eu.error.message} aoTentarDeNovo={() => void eu.refetch()} />;
  if (!eu.data) return <Navigate to="/entrar" replace />;

  async function encerrar() {
    try {
      await sair();
    } catch (e) {
      // A sessão pode continuar valendo no servidor: não finge que saiu.
      setErroSair(`Não foi possível sair: ${e instanceof Error ? e.message : 'erro desconhecido'}. Tente de novo.`);
      return;
    }
    cliente.clear();
    await navegar('/entrar', { replace: true });
  }

  return (
    <AppShell
      nomeSistema={NOME_SISTEMA}
      grupos={gruposDo(eu.data.papel)}
      usuario={{ nome: eu.data.nome, papel: ROTULO_PAPEL[eu.data.papel] }}
      versao={saude.data?.versao}
      aoSair={() => void encerrar()}
    >
      {erroSair && (
        <p role="alert" className="mb-4 rounded-md bg-perigo-suave px-3 py-2 text-13 text-perigo">
          {erroSair}
        </p>
      )}
      <Outlet />
    </AppShell>
  );
}

function PaginaEntrar() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  function aoEntrar() {
    // Descarta o "sem sessão" guardado: o Layout busca /api/auth/eu de novo, já com o cookie.
    cliente.removeQueries({ queryKey: CHAVE_EU });
    void navegar('/', { replace: true });
  }
  return <TelaEntrar nomeSistema={NOME_SISTEMA} aoEntrar={aoEntrar} />;
}

function PaginaNovoCedente() {
  const navegar = useNavigate();
  return <TelaFormulario aoSalvar={() => void navegar('/cedentes')} />;
}

// Cada tela nova entra aqui. Rotas desconhecidas caem no SPA; a API só responde em /api/*.
const roteador = createBrowserRouter([
  { path: '/entrar', element: <PaginaEntrar /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TelaPainel /> },
      { path: '/cedentes', element: <TelaListagem /> },
      { path: '/cedentes/novo', element: <PaginaNovoCedente /> },
      { path: '/usuarios', element: <TelaUsuarios /> },
      { path: '/admin/auditoria', element: <TelaAuditoria /> },
      { path: '/sistema', element: <Inicio /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  );
}
