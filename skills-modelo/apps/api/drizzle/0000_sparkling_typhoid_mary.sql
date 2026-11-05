CREATE TYPE "public"."papel" AS ENUM('ADMIN', 'GESTOR', 'USUARIO');--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"papel" "papel" DEFAULT 'USUARIO' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_email_unico" ON "usuario" USING btree (lower("email"));