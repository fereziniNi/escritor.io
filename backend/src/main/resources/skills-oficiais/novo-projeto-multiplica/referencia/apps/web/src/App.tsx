// origem: skills-modelo/apps/web/src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { Inicio } from '@/telas/Inicio';

const clienteConsultas = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

// Cada tela nova entra aqui. Rotas desconhecidas caem no SPA; a API só responde em /api/*.
const roteador = createBrowserRouter([{ path: '/', element: <Inicio /> }]);

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  );
}
