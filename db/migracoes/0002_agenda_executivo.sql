CREATE TABLE "agenda_dia" (
	"autoridade" text NOT NULL,
	"data" date NOT NULL,
	"publicada" boolean NOT NULL,
	"aviso" text,
	"fuso_min" integer,
	"url" text NOT NULL,
	"coletado_em" timestamp with time zone NOT NULL,
	CONSTRAINT "agenda_dia_autoridade_data_pk" PRIMARY KEY("autoridade","data")
);
--> statement-breakpoint
CREATE TABLE "agenda_executivo" (
	"id" serial PRIMARY KEY NOT NULL,
	"autoridade" text NOT NULL,
	"data" date NOT NULL,
	"ordem" integer NOT NULL,
	"inicio" timestamp with time zone,
	"inicio_texto" text,
	"hora_local" boolean DEFAULT false NOT NULL,
	"titulo" text NOT NULL,
	"local" text,
	"url" text,
	"coletado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agenda_exec_data_idx" ON "agenda_executivo" USING btree ("autoridade","data");