CREATE TABLE "norma" (
	"codigo" integer PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"numero" integer NOT NULL,
	"ano" integer NOT NULL,
	"nome" text NOT NULL,
	"ementa" text,
	"data_assinatura" date NOT NULL,
	"url" text NOT NULL,
	"proposicao_id" integer,
	"origem_consultada" boolean DEFAULT false NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "veto" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo_senado" integer NOT NULL,
	"codigo_materia" integer NOT NULL,
	"numero" integer NOT NULL,
	"ano" integer NOT NULL,
	"proposicao_id" integer,
	"total" boolean,
	"assunto" text,
	"ementa" text,
	"comentario" text,
	"data_publicacao" date,
	"data_recebimento" date,
	"data_sobrestacao" date,
	"sobrestando" boolean,
	"em_tramitacao" boolean,
	"url_mensagem" text,
	"resultado" text NOT NULL,
	"dispositivos" jsonb,
	"fonte_url" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposicao" ADD COLUMN "norma_gerada" text;--> statement-breakpoint
ALTER TABLE "proposicao" ADD COLUMN "url_norma" text;--> statement-breakpoint
ALTER TABLE "proposicao" ADD COLUMN "data_norma" date;--> statement-breakpoint
ALTER TABLE "norma" ADD CONSTRAINT "norma_proposicao_id_proposicao_id_fk" FOREIGN KEY ("proposicao_id") REFERENCES "public"."proposicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veto" ADD CONSTRAINT "veto_proposicao_id_proposicao_id_fk" FOREIGN KEY ("proposicao_id") REFERENCES "public"."proposicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "norma_data_idx" ON "norma" USING btree ("data_assinatura");--> statement-breakpoint
CREATE UNIQUE INDEX "veto_codigo_uq" ON "veto" USING btree ("codigo_senado");--> statement-breakpoint
CREATE INDEX "veto_data_idx" ON "veto" USING btree ("data_publicacao");