// origem: skills-modelo/apps/web/src/App.tsx
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Activity, LayoutDashboard, Users } from 'lucide-react';
import { Outlet, RouterProvider, createBrowserRouter, useNavigate } from 'react-router';
import { AppShell, type GrupoMenu } from '@/componentes/AppShell';
import { buscarSaude } from '@/lib/api';
import { Inicio } from '@/telas/Inicio';
import { TelaFormulario } from '@/telas/modelo/TelaFormulario';
import { TelaListagem } from '@/telas/modelo/TelaListagem';
import { TelaLogin } from '@/telas/modelo/TelaLogin';
import { TelaPainel } from '@/telas/modelo/TelaPainel';

const clienteConsultas = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const NOME_SISTEMA = 'Sistema';

const grupos: GrupoMenu[] = [
  {
    titulo: 'Operação',
    itens: [
      { rotulo: 'Painel', para: '/', icone: <LayoutDashboard className="size-4" /> },
      { rotulo: 'Cedentes', para: '/cedentes', icone: <Users className="size-4" /> },
    ],
  },
  { titulo: 'Admin', itens: [{ rotulo: 'Estado do sistema', para: '/sistema', icone: <Activity className="size-4" /> }] },
];

/** Telas logadas: sidebar navy com a versão que a API informa em /api/health. */
function Layout() {
  const saude = useQuery({ queryKey: ['saude'], queryFn: buscarSaude });
  return (
    <AppShell nomeSistema={NOME_SISTEMA} grupos={grupos} usuario={{ nome: 'Ana Souza', papel: 'Gestor' }} versao={saude.data?.versao}>
      <Outlet />
    </AppShell>
  );
}

function PaginaLogin() {
  const navegar = useNavigate();
  // O login de verdade é de outra skill; aqui a tela-modelo só leva ao painel.
  return <TelaLogin nomeSistema={NOME_SISTEMA} aoEntrar={() => void navegar('/')} />;
}

function PaginaNovoCedente() {
  const navegar = useNavigate();
  return <TelaFormulario aoSalvar={() => void navegar('/cedentes')} />;
}

// Cada tela nova entra aqui. Rotas desconhecidas caem no SPA; a API só responde em /api/*.
const roteador = createBrowserRouter([
  { path: '/entrar', element: <PaginaLogin /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TelaPainel /> },
      { path: '/cedentes', element: <TelaListagem /> },
      { path: '/cedentes/novo', element: <PaginaNovoCedente /> },
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
