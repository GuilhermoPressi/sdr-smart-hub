import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApifyLeadsModule } from './apify-leads/apify-leads.module';
import { MessagesModule } from './messages/messages.module';
import { AiConfigModule } from './ai-config/ai-config.module';
import { EvolutionModule } from './evolution/evolution.module';
import { OpenaiModule } from './openai/openai.module';
import { ContactsModule } from './contacts/contacts.module';
import { Contact } from './contacts/entities/contact.entity';
import { ApifyLeadSearch } from './apify-leads/entities/apify-lead-search.entity';
import { Message } from './messages/entities/message.entity';
import { AiConfig } from './ai-config/entities/ai-config.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'sdr_smart_hub',
      entities: [Contact, ApifyLeadSearch, Message, AiConfig],
      synchronize: true,
      ssl: false,
    }),
    ApifyLeadsModule,
    MessagesModule,
    AiConfigModule,
    EvolutionModule,
    OpenaiModule,
    ContactsModule,
  ],
})
export class AppModule {}
