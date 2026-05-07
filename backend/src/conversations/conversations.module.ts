import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { AiReplyService } from './ai-reply.service';
import { Contact } from '../contacts/entities/contact.entity';
import { MessagesModule } from '../messages/messages.module';
import { OpenaiModule } from '../openai/openai.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Contact]),
    forwardRef(() => MessagesModule),
    forwardRef(() => OpenaiModule),
    forwardRef(() => AiConfigModule),
    forwardRef(() => EvolutionModule),
  ],
  providers: [ConversationsService, AiReplyService],
  controllers: [ConversationsController],
  exports: [ConversationsService, AiReplyService],
})
export class ConversationsModule {}
