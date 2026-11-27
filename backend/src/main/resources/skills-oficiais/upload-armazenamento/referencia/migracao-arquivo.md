# Migração da tabela de arquivos

A tabela `arquivo` (metadados: dono, escopo, chave do objeto, tipo, tamanho, varredura) vem de `apps/api/src/armazenamento/arquivo.tabela.ts`.
Não escreva o SQL à mão: copie a tabela, exporte-a em `apps/api/src/banco/esquema.ts` (ver `referencia/apps/api/src/banco/esquema.ts`) e gere:

```bash
pnpm --filter api db:generate -- --name=arquivo
pnpm --filter api db:migrate
```

No modelo a migração é a `0007` (depois do `0006_indice_cliente_exportacao` da skill `exportacao-excel-pdf-csv`). O SQL gerado tem de ser equivalente a:

<!-- arquivo: skills-modelo/apps/api/drizzle/0007_arquivo.sql -->
```sql
CREATE TABLE "arquivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" text NOT NULL,
	"nome_original" text NOT NULL,
	"tipo" text NOT NULL,
	"tamanho" bigint NOT NULL,
	"dono_id" uuid NOT NULL,
	"escopo" text DEFAULT 'PRIVADO' NOT NULL,
	"varredura" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"removido_em" timestamp with time zone,
	CONSTRAINT "arquivo_escopo_valido" CHECK ("arquivo"."escopo" in ('PRIVADO', 'GESTAO')),
	CONSTRAINT "arquivo_varredura_valida" CHECK ("arquivo"."varredura" in ('LIMPO', 'NAO_VARRIDO')),
	CONSTRAINT "arquivo_tamanho_positivo" CHECK ("arquivo"."tamanho" > 0)
);
--> statement-breakpoint
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_dono_id_usuario_id_fk" FOREIGN KEY ("dono_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arquivo_chave_unica" ON "arquivo" USING btree ("chave");--> statement-breakpoint
CREATE INDEX "arquivo_dono_criado_em" ON "arquivo" USING btree ("dono_id","criado_em");
```

O papel `app_runtime` já tem SELECT/INSERT/UPDATE/DELETE em tabelas novas (privilégios padrão da skill `trilha-auditoria`): nada a conceder.
