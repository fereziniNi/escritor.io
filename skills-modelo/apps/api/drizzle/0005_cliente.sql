CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"cpf_cifrado" text,
	"cpf_indice" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrado_em" timestamp with time zone,
	"anonimizado_em" timestamp with time zone,
	CONSTRAINT "cliente_cpf_cifrado_formato" CHECK ("cliente"."cpf_cifrado" ~ '^[a-z0-9][a-z0-9-]{0,31}:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$'),
	CONSTRAINT "cliente_cpf_indice_formato" CHECK ("cliente"."cpf_indice" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "cliente_cpf_com_indice" CHECK (("cliente"."cpf_cifrado" is null) = ("cliente"."cpf_indice" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cliente_cpf_indice_unico" ON "cliente" USING btree ("cpf_indice");--> statement-breakpoint
CREATE INDEX "cliente_encerrado_em" ON "cliente" USING btree ("encerrado_em");