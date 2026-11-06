# Dados pessoais no <NOME DO SISTEMA> (LGPD)

<!-- Modelo da skill lgpd-dados-pessoais. Copie para docs/lgpd.md do projeto, troque cada <...> e apague este comentário.
     Este documento é o ponto de partida para a validação com o jurídico e o encarregado de dados (DPO) do cliente:
     marque **a definir** onde ainda não houve decisão. Nunca coloque aqui chave, senha ou dado real de pessoa. -->

Este documento descreve o que o sistema guarda sobre pessoas físicas, por quê, por quanto tempo e quem acessa, e como
isso é protegido. Responsável técnico: <nome>. Encarregado (DPO) do cliente: <nome ou **a definir**>. Última revisão: <data>.

## Princípios aplicados

- **Finalidade.** Os dados pessoais entram para <finalidade>. Não há outro uso.
- **Minimização.** Só guardamos o que a tela ou o processo usa. <O que deixamos de guardar de propósito>.
- **Segurança.** CPF cifrado no banco (AES-256-GCM, chave por `kid`) com índice cego para busca; quem não é GESTOR ou
  ADMIN vê CPF e e-mail mascarados; dado pessoal nunca vai para log, métrica ou trilha de auditoria em claro.
- **Retenção.** Depois do prazo, o titular é anonimizado (o registro fica, sem o dado pessoal).

## O que é guardado

| Dado | Onde (tabela.coluna) | Por quê (finalidade) | Base legal (art. 7º) | Proteção | Quem vê | Retenção |
|---|---|---|---|---|---|---|
| CPF do cliente | `cliente.cpf_cifrado` + `cliente.cpf_indice` | Identificar o cliente e evitar cadastro duplicado | **a definir** (ex.: execução de contrato) | Cifrado (AES-256-GCM, AAD `cliente.cpf`); busca pelo índice cego HMAC-SHA256 | GESTOR e ADMIN completo; USUARIO `***.456.789-**` | Até `RETENCAO_DIAS` depois do encerramento, então anonimizado |
| Nome do cliente | `cliente.nome` | Exibir e conferir | **a definir** | Em claro (exibição); nunca em log nem na auditoria | Todos os papéis | Idem (vira "Titular anonimizado") |
| E-mail do cliente | `cliente.email` | Contato | **a definir** | Em claro; mascarado `a***@dominio` para USUARIO | GESTOR e ADMIN completo | Idem (apagado) |
| E-mail, nome e papel de usuário do sistema | `usuario` | Login e autorização | **a definir** (legítimo interesse / contrato de trabalho) | E-mail é o identificador do login | ADMIN | Enquanto houver vínculo; desativar em vez de apagar |
| Pedidos de código de login (e-mail digitado) | `codigo_login` | Limite de tentativas | **a definir** | Código só como HMAC | Interno | `RETENCAO_DIAS` (comando de retenção) |
| Sessões | `sessao` | Manter o login | **a definir** | Só o SHA-256 do token | Interno | `RETENCAO_DIAS` depois de vencidas |
| Trilha de auditoria (ator, ação, IP) | `evento_auditoria` | Prestação de contas e segurança | **a definir** (legítimo interesse) | Imutável; e-mail só mascarado; nunca CPF nem nome | ADMIN | IP: `RETENCAO_AUDITORIA_IP_DIAS` (**a definir**); evento: **a definir** |
| Logs | stdout | Operação | Legítimo interesse | Sem dado pessoal (`redact` + varredura de CPF) | Operação | Conforme a plataforma |
| <outro dado> | <tabela.coluna> | <por quê> | <base> | <proteção> | <quem> | <prazo> |

## Proteção técnica

- **Criptografia de campo** (`apps/api/src/lgpd/chaveiro.ts`): AES-256-GCM, IV aleatório de 12 bytes, tag de 16 bytes,
  AAD = nome da coluna; envelope `kid:iv:tag:cifra` (base64). O banco recusa CPF em claro (CHECK do formato).
- **Chaves**: `DADOS_CHAVES` (`kid:base64`, 32 bytes, a primeira cifra) e `DADOS_CHAVE_INDICE` (HMAC do índice cego,
  diferente das de dados). Guardadas em <cofre de segredos / arquivo de segredo do compose>, fora do repositório e do
  servidor de banco. Quem tem acesso: <nomes/papéis>. Perder as chaves = perder os CPFs.
- **Rotação**: chave nova na frente de `DADOS_CHAVES` → reiniciar → `lgpd:recifrar` → retirar a antiga. Última rotação: <data>.
  Periodicidade: <**a definir**, sugestão anual ou após incidente>.
- **Máscara por papel**: interceptor global; só GESTOR e ADMIN veem CPF e e-mail completos.
- **Logs**: campos `cpf`, `email`, `telefone`, `celular`, `dataNascimento`, `rg` saem `[REDACTED]`; CPF em qualquer
  texto sai `***.456.789-**`. CPF nunca na URL (busca por POST).

## Direitos do titular (art. 18)

| Pedido | Como atender | Quem |
|---|---|---|
| Confirmação e acesso / portabilidade | `GET /api/admin/lgpd/titulares/<id>/exportar` (JSON em anexo; fica na auditoria como `lgpd.exportar_titular`) | ADMIN |
| Eliminação | `POST /api/admin/lgpd/titulares/<id>/anonimizar` (troca nome, e-mail e CPF; mantém o id; `lgpd.anonimizar_titular`) | ADMIN |
| Correção | Tela de cadastro <onde> | <papel> |
| Informação sobre compartilhamento | Seção abaixo | Encarregado |

Prazo de resposta ao titular: <**a definir** com o jurídico>. Canal do titular: <e-mail do encarregado>.

## Retenção e expurgo

- `RETENCAO_DIAS` = <valor ou **a definir**>: o comando `lgpd:retencao`, agendado <quando/onde>, anonimiza cliente encerrado
  há mais tempo que isso e apaga códigos de login e sessões vencidas. Vazio = nada é expurgado.
- `RETENCAO_AUDITORIA_IP_DIAS` = <valor ou **a definir**>: o mesmo comando apaga o IP dos eventos de auditoria mais velhos,
  conectado como o dono do banco (decisão registrada no `CLAUDE.md`; o evento `auditoria.expurgo` registra cada execução).
- Backups: <prazo e como o expurgo vale para eles, **a definir**>.

## Compartilhamento com terceiros

| Com quem | O quê | Por quê | Contrato/cláusula |
|---|---|---|---|
| <provedor de e-mail> | E-mail do usuário (código de login, convite) | Envio de e-mail transacional | <a definir> |
| <outro> | | | |

## Pendências (decidir com jurídico/DPO)

1. Prazos de retenção (`RETENCAO_DIAS`, `RETENCAO_AUDITORIA_IP_DIAS`) e base legal de cada dado.
2. Prazo de guarda da trilha de auditoria.
3. Cofre de segredos e procedimento de rotação em produção.
4. <outra pendência>
