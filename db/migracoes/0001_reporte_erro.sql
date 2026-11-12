CREATE TABLE "reporte_erro" (
	"id" serial PRIMARY KEY NOT NULL,
	"url_pagina" text NOT NULL,
	"descricao" text NOT NULL,
	"email_contato" text,
	"status" text DEFAULT 'aberto' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
