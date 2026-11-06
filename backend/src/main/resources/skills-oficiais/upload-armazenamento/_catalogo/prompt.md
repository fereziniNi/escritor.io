Use a skill upload-armazenamento para criar o envio e o download de arquivos deste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Receba o arquivo em fluxo (busboy) com limite UPLOAD_MAX_MB, confira o tipo pelos bytes (PDF, PNG, JPEG, XLSX) e grave sob uma chave gerada no servidor, nunca pelo nome do cliente.
Só o dono (ou o papel permitido) vê, baixa e remove; entregue sempre como anexo com nosniff, e registre arquivo.enviar, arquivo.baixar e arquivo.remover na auditoria.
Escolha o armazenamento por ARMAZENAMENTO_TIPO (local, s3 ou azure), ligue o ClamAV só se o projeto pedir e peça à skill de instalação o limite do Caddy.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build e mostre o checklist de pronto.
