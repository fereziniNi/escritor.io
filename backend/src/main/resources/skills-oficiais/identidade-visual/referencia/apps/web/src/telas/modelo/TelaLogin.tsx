// origem: skills-modelo/apps/web/src/telas/modelo/TelaLogin.tsx
import { type FormEvent, useState } from 'react';
import { Campo } from '@/componentes/Campo';
import { Button } from '@/componentes/ui/button';

interface Props {
  nomeSistema: string;
  aoEntrar: (dados: { email: string; senha: string }) => void;
  /** Mensagem de erro da tentativa anterior (ex.: "Credenciais inválidas"). */
  erro?: string;
}

/** Tela de entrada: cartão centralizado com a marca. O mecanismo de login (senha, código por e-mail) é de outra skill. */
export function TelaLogin({ nomeSistema, aoEntrar, erro }: Props) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  function enviar(e: FormEvent) {
    e.preventDefault();
    aoEntrar({ email, senha });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo p-4">
      <form onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-borda bg-superficie p-6">
        <div>
          <div className="font-display text-2xl font-bold text-texto">
            Beyond<span className="text-primaria">{nomeSistema}</span>
          </div>
          <div className="text-[10px] tracking-[0.14em] text-texto-3">MULTIPLICA</div>
        </div>
        {erro && (
          <p role="alert" className="rounded-md bg-perigo-suave px-3 py-2 text-13 text-perigo">
            {erro}
          </p>
        )}
        <Campo rotulo="E-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        <Button type="submit">Entrar</Button>
      </form>
    </div>
  );
}
