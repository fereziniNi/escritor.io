// origem: skills-modelo/apps/web/src/telas/TelaEntrar.tsx
import { type FormEvent, useState } from 'react';
import { Campo } from '@/componentes/Campo';
import { Button } from '@/componentes/ui/button';
import { ErroApi } from '@/lib/api';
import { entrar, pedirCodigo } from '@/lib/auth-api';

interface Props {
  nomeSistema: string;
  /** Chamado depois do 204 de /api/auth/entrar (o cookie de sessão já está no navegador). */
  aoEntrar: () => void;
}

const mensagemDe = (e: unknown) => (e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.');

/**
 * Login por código no e-mail, no visual da tela-modelo TelaLogin (skill identidade-visual): cartão centralizado com a
 * marca. Passo 1: e-mail → POST /api/auth/codigo. Passo 2: código de 6 dígitos → POST /api/auth/entrar.
 * A mensagem do passo 1 é a da API, igual para quem tem e quem não tem acesso.
 */
export function TelaEntrar({ nomeSistema, aoEntrar }: Props) {
  const [passo, setPasso] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarEmail(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      setAviso(await pedirCodigo(email));
      setCodigo('');
      setPasso('codigo');
    } catch (falha) {
      setErro(mensagemDe(falha));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, codigo);
      aoEntrar();
    } catch (falha) {
      setErro(mensagemDe(falha));
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }

  function voltar() {
    setPasso('email');
    setAviso(null);
    setErro(null);
    setCodigo('');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo p-4">
      <form
        onSubmit={passo === 'email' ? enviarEmail : enviarCodigo}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-borda bg-superficie p-6"
      >
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
        {passo === 'email' ? (
          <>
            <Campo rotulo="E-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" disabled={enviando}>
              Receber código
            </Button>
          </>
        ) : (
          <>
            <p role="status" className="text-13 text-texto-2">
              {aviso}
            </p>
            <p className="text-13 text-texto-2">
              E-mail: <strong className="text-texto">{email}</strong>
            </p>
            <Campo
              rotulo="Código"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
            />
            <Button type="submit" disabled={enviando || codigo.length !== 6}>
              Entrar
            </Button>
            <Button type="button" variant="ghost" onClick={voltar}>
              Usar outro e-mail
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
