CREATE TABLE "autoria" (
	"proposicao_id" integer NOT NULL,
	"parlamentar_id" integer NOT NULL,
	"proponente" boolean DEFAULT true NOT NULL,
	CONSTRAINT "autoria_proposicao_id_parlamentar_id_pk" PRIMARY KEY("proposicao_id","parlamentar_id")
);
--> statement-breakpoint
CREATE TABLE "bruto" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"coleta_id" integer,
	"url" text NOT NULL,
	"status_http" integer NOT NULL,
	"sha256" text NOT NULL,
	"armazenamento" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coleta" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fonte_id" text NOT NULL,
	"tarefa" text NOT NULL,
	"iniciado_em" timestamp with time zone NOT NULL,
	"terminado_em" timestamp with time zone,
	"status" text NOT NULL,
	"itens_lidos" integer,
	"itens_alterados" integer,
	"erro" text
);
--> statement-breakpoint
CREATE TABLE "despesa" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"parlamentar_id" integer NOT NULL,
	"id_fonte" text NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"categoria" text NOT NULL,
	"data_documento" date,
	"valor" numeric(12, 2) NOT NULL,
	"fornecedor_nome" text,
	"fornecedor_cnpj" text,
	"url_documento" text
);
--> statement-breakpoint
CREATE TABLE "evento" (
	"id" serial PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"id_fonte" text NOT NULL,
	"tipo" text NOT NULL,
	"deliberativa" boolean,
	"titulo" text NOT NULL,
	"descricao" text,
	"orgaos" text,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"status" text NOT NULL,
	"status_original" text,
	"local" text,
	"link_video" text,
	"url_pauta" text,
	"pauta" jsonb,
	"hash_conteudo" text NOT NULL,
	"fonte_url" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fonte" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"url_base" text NOT NULL,
	"falhas_seguidas" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenca" (
	"id" serial PRIMARY KEY NOT NULL,
	"parlamentar_id" integer NOT NULL,
	"codigo_fonte" integer NOT NULL,
	"inicio" date NOT NULL,
	"fim" date,
	"tipo_sigla" text,
	"tipo_descricao" text,
	"fonte_url" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membro_orgao" (
	"parlamentar_id" integer NOT NULL,
	"orgao_id" integer NOT NULL,
	"cargo" text NOT NULL,
	"inicio" date NOT NULL,
	"fim" date,
	CONSTRAINT "membro_orgao_parlamentar_id_orgao_id_inicio_cargo_pk" PRIMARY KEY("parlamentar_id","orgao_id","inicio","cargo")
);
--> statement-breakpoint
CREATE TABLE "mudanca" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" integer NOT NULL,
	"dados" jsonb NOT NULL,
	"detectado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgao" (
	"id" serial PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"id_fonte" integer NOT NULL,
	"sigla" text,
	"nome" text NOT NULL,
	"tipo" text
);
--> statement-breakpoint
CREATE TABLE "orientacao" (
	"votacao_id" integer NOT NULL,
	"bancada" text NOT NULL,
	"tipo_bancada" text,
	"orientacao" text NOT NULL,
	"orientacao_original" text NOT NULL,
	CONSTRAINT "orientacao_votacao_id_bancada_pk" PRIMARY KEY("votacao_id","bancada")
);
--> statement-breakpoint
CREATE TABLE "parlamentar" (
	"id" serial PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"id_fonte" integer NOT NULL,
	"nome_parlamentar" text NOT NULL,
	"nome_civil" text,
	"sexo" text,
	"partido" text,
	"uf" char(2),
	"url_foto" text,
	"email" text,
	"telefone" text,
	"em_exercicio" boolean NOT NULL,
	"situacao" text,
	"url_pagina_oficial" text,
	"slug" text NOT NULL,
	"fonte_url" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presenca_evento" (
	"evento_id" integer NOT NULL,
	"parlamentar_id" integer NOT NULL,
	CONSTRAINT "presenca_evento_evento_id_parlamentar_id_pk" PRIMARY KEY("evento_id","parlamentar_id")
);
--> statement-breakpoint
CREATE TABLE "presenca_resumo" (
	"parlamentar_id" integer NOT NULL,
	"ano" integer NOT NULL,
	"ambito" text NOT NULL,
	"presencas" integer,
	"ausencias_justificadas" integer,
	"ausencias_nao_justificadas" integer,
	"unidade" text NOT NULL,
	"fonte_url" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL,
	CONSTRAINT "presenca_resumo_parlamentar_id_ano_ambito_pk" PRIMARY KEY("parlamentar_id","ano","ambito")
);
--> statement-breakpoint
CREATE TABLE "presenca_votacao" (
	"votacao_id" integer NOT NULL,
	"parlamentar_id" integer NOT NULL,
	"situacao" text NOT NULL,
	"codigo_original" text NOT NULL,
	"descricao_original" text,
	CONSTRAINT "presenca_votacao_votacao_id_parlamentar_id_pk" PRIMARY KEY("votacao_id","parlamentar_id")
);
--> statement-breakpoint
CREATE TABLE "proposicao" (
	"id" serial PRIMARY KEY NOT NULL,
	"sigla" text NOT NULL,
	"numero" integer NOT NULL,
	"ano" integer NOT NULL,
	"id_camara" integer,
	"id_senado" integer,
	"casa_iniciadora" text,
	"ementa" text,
	"apelido" text,
	"situacao_camara" text,
	"situacao_senado" text,
	"data_apresentacao" date,
	"url_inteiro_teor" text,
	"slug" text NOT NULL,
	"hash_conteudo" text,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tramitacao" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"proposicao_id" integer NOT NULL,
	"casa" text NOT NULL,
	"data_hora" timestamp with time zone NOT NULL,
	"sequencia" integer NOT NULL,
	"orgao_sigla" text,
	"descricao" text,
	"situacao" text,
	"despacho" text,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "votacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"casa" text NOT NULL,
	"id_fonte" text NOT NULL,
	"evento_id" integer,
	"proposicao_id" integer,
	"data_hora" timestamp with time zone NOT NULL,
	"descricao" text NOT NULL,
	"nominal" boolean NOT NULL,
	"secreta" boolean DEFAULT false NOT NULL,
	"aprovada" boolean,
	"placar_sim" integer,
	"placar_nao" integer,
	"placar_abstencao" integer,
	"placar_obstrucao" integer,
	"placar_calculado" boolean DEFAULT false NOT NULL,
	"fonte_url" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voto" (
	"votacao_id" integer NOT NULL,
	"parlamentar_id" integer NOT NULL,
	"partido" text,
	"tipo_voto" text NOT NULL,
	"tipo_voto_original" text NOT NULL,
	"registrado_em" timestamp with time zone,
	CONSTRAINT "voto_votacao_id_parlamentar_id_pk" PRIMARY KEY("votacao_id","parlamentar_id")
);
--> statement-breakpoint
ALTER TABLE "autoria" ADD CONSTRAINT "autoria_proposicao_id_proposicao_id_fk" FOREIGN KEY ("proposicao_id") REFERENCES "public"."proposicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autoria" ADD CONSTRAINT "autoria_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bruto" ADD CONSTRAINT "bruto_coleta_id_coleta_id_fk" FOREIGN KEY ("coleta_id") REFERENCES "public"."coleta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coleta" ADD CONSTRAINT "coleta_fonte_id_fonte_id_fk" FOREIGN KEY ("fonte_id") REFERENCES "public"."fonte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa" ADD CONSTRAINT "despesa_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenca" ADD CONSTRAINT "licenca_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_orgao" ADD CONSTRAINT "membro_orgao_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_orgao" ADD CONSTRAINT "membro_orgao_orgao_id_orgao_id_fk" FOREIGN KEY ("orgao_id") REFERENCES "public"."orgao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orientacao" ADD CONSTRAINT "orientacao_votacao_id_votacao_id_fk" FOREIGN KEY ("votacao_id") REFERENCES "public"."votacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presenca_evento" ADD CONSTRAINT "presenca_evento_evento_id_evento_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."evento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presenca_evento" ADD CONSTRAINT "presenca_evento_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presenca_resumo" ADD CONSTRAINT "presenca_resumo_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presenca_votacao" ADD CONSTRAINT "presenca_votacao_votacao_id_votacao_id_fk" FOREIGN KEY ("votacao_id") REFERENCES "public"."votacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presenca_votacao" ADD CONSTRAINT "presenca_votacao_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tramitacao" ADD CONSTRAINT "tramitacao_proposicao_id_proposicao_id_fk" FOREIGN KEY ("proposicao_id") REFERENCES "public"."proposicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votacao" ADD CONSTRAINT "votacao_evento_id_evento_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."evento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votacao" ADD CONSTRAINT "votacao_proposicao_id_proposicao_id_fk" FOREIGN KEY ("proposicao_id") REFERENCES "public"."proposicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voto" ADD CONSTRAINT "voto_votacao_id_votacao_id_fk" FOREIGN KEY ("votacao_id") REFERENCES "public"."votacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voto" ADD CONSTRAINT "voto_parlamentar_id_parlamentar_id_fk" FOREIGN KEY ("parlamentar_id") REFERENCES "public"."parlamentar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bruto_url_idx" ON "bruto" USING btree ("url","coletado_em");--> statement-breakpoint
CREATE INDEX "coleta_fonte_idx" ON "coleta" USING btree ("fonte_id","iniciado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "despesa_uq" ON "despesa" USING btree ("parlamentar_id","id_fonte");--> statement-breakpoint
CREATE INDEX "despesa_parl_idx" ON "despesa" USING btree ("parlamentar_id","ano","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "evento_uq" ON "evento" USING btree ("casa","id_fonte");--> statement-breakpoint
CREATE INDEX "evento_inicio_idx" ON "evento" USING btree ("inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "licenca_uq" ON "licenca" USING btree ("parlamentar_id","codigo_fonte");--> statement-breakpoint
CREATE INDEX "mudanca_entidade_idx" ON "mudanca" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orgao_uq" ON "orgao" USING btree ("casa","id_fonte");--> statement-breakpoint
CREATE UNIQUE INDEX "parlamentar_casa_id_uq" ON "parlamentar" USING btree ("casa","id_fonte");--> statement-breakpoint
CREATE UNIQUE INDEX "parlamentar_slug_uq" ON "parlamentar" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "proposicao_uq" ON "proposicao" USING btree ("sigla","numero","ano");--> statement-breakpoint
CREATE UNIQUE INDEX "proposicao_slug_uq" ON "proposicao" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tramitacao_uq" ON "tramitacao" USING btree ("proposicao_id","casa","sequencia");--> statement-breakpoint
CREATE UNIQUE INDEX "votacao_uq" ON "votacao" USING btree ("casa","id_fonte");--> statement-breakpoint
CREATE INDEX "votacao_data_idx" ON "votacao" USING btree ("data_hora");--> statement-breakpoint
CREATE INDEX "voto_parlamentar_idx" ON "voto" USING btree ("parlamentar_id");