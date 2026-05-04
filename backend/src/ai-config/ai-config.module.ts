import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConfig } from './entities/ai-config.entity';
import { AiConfigService } from './ai-config.service';
import { AiConfigController } from './ai-config.controller';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiConfig]), OpenaiModule],
  providers: [AiConfigService],
  controllers: [AiConfigController],
  exports: [AiConfigService],
})
export class AiConfigModule {}
