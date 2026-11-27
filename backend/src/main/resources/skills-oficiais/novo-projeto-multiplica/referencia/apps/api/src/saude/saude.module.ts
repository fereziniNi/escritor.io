// origem: skills-modelo/apps/api/src/saude/saude.module.ts
import { Module } from '@nestjs/common';
import { SaudeController } from './saude.controller';

@Module({ controllers: [SaudeController] })
export class SaudeModule {}
