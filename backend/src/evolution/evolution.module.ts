import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from '../contacts/entities/contact.entity';
import { EvolutionService } from './evolution.service';
import { EvolutionController } from './evolution.controller';
import { WebhookController } from './webhook.controller';
import { MessagesModule } from '../messages/messages.module';
import { OpenaiModule } from '../openai/openai.module';
import { AiConfigModule } from '../ai-config/ai-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact]),
    MessagesModule,
    OpenaiModule,
    AiConfigModule,
  ],
  providers: [EvolutionService],
  controllers: [EvolutionController, WebhookController],
  exports: [EvolutionService],
})
export class EvolutionModule {}
