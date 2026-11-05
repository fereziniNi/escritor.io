CREATE TABLE "evento_auditoria" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "evento_auditoria_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ator_id" uuid,
	"acao" text NOT NULL,
	"alvo_tipo" text,
	"alvo_id" text,
	"antes" jsonb,
	"depois" jsonb,
	"ip" text,
	"request_id" text
);
--> statement-breakpoint
CREATE INDEX "evento_auditoria_ocorrido" ON "evento_auditoria" USING btree ("ocorrido_em");--> statement-breakpoint
CREATE INDEX "evento_auditoria_ator" ON "evento_auditoria" USING btree ("ator_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "evento_auditoria_acao" ON "evento_auditoria" USING btree ("acao","ocorrido_em");--> statement-breakpoint
CREATE INDEX "evento_auditoria_alvo" ON "evento_auditoria" USING btree ("alvo_tipo","alvo_id");