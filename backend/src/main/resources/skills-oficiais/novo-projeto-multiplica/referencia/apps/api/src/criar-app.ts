// origem: skills-modelo/apps/api/src/criar-app.ts
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, type OpcoesApp } from './app.module';
import { type Config } from './config/config';
import { configurarApp } from './configurar-app';

/** Cria a aplicação Nest já configurada (sem escutar porta). Usada pelo main.ts e pelos testes e2e. */
export async function criarApp(config: Config, opcoes: OpcoesApp = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.registrar(config, opcoes), { bufferLogs: true });
  return configurarApp(app, config);
}
