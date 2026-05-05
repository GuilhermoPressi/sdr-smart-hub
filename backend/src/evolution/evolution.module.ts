import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvolutionService } from './evolution.service';
import { EvolutionController } from './evolution.controller';
import { WebhookController } from './webhook.controller';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { OpenaiModule } from '../openai/openai.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { EvolutionInstance } from './entities/evolution-instance.entity';
import { Contact } from '../contacts/entities/contact.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EvolutionInstance, Contact]),
    forwardRef(() => ContactsModule),
    forwardRef(() => MessagesModule),
    forwardRef(() => OpenaiModule),
    forwardRef(() => AiConfigModule),
  ],
  providers: [EvolutionService],
  controllers: [EvolutionController, WebhookController],
  exports: [EvolutionService],
})
export class EvolutionModule {}
