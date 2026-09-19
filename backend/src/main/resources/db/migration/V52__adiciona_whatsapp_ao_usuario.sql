-- Pedido do usuário: avisar por WhatsApp quando uma tarefa é concluída ou uma mensagem de chat
-- chega, além do aviso já existente na tela. Diferente do "chefe" (um número só, fixo, pra toda a
-- empresa), aqui é o WhatsApp de CADA colaborador - opcional (nullable, sem valor padrão): quem
-- não tiver isso preenchido simplesmente não recebe aviso por WhatsApp, só continua recebendo a
-- notificação no navegador de sempre. Só ADMIN cadastra/edita esse número (ver UsuarioController).
ALTER TABLE usuario ADD COLUMN whatsapp VARCHAR(20);
