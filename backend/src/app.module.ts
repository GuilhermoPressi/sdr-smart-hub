import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApifyLeadsModule } from './apify-leads/apify-leads.module';
import { MessagesModule } from './messages/messages.module';
import { AiConfigModule } from './ai-config/ai-config.module';
import { EvolutionModule } from './evolution/evolution.module';
import { OpenaiModule } from './openai/openai.module';
import { ContactsModule } from './contacts/contacts.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { Contact } from './contacts/entities/contact.entity';
import { ApifyLeadSearch } from './apify-leads/entities/apify-lead-search.entity';
import { Message } from './messages/entities/message.entity';
import { AiConfig } from './ai-config/entities/ai-config.entity';
import { Campaign } from './campaigns/entities/campaign.entity';
import { AuthModule } from './auth/auth.module';
import { CampaignRecipient } from './campaigns/entities/campaign-recipient.entity';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { EvolutionInstance } from './evolution/entities/evolution-instance.entity';
import { ConversationsModule } from './conversations/conversations.module';
import { Conversation } from './conversations/entities/conversation.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'sdr_smart_hub',
      entities: [Contact, ApifyLeadSearch, Message, AiConfig, Campaign, CampaignRecipient, User, EvolutionInstance, Conversation],
      synchronize: true,
      ssl: false,
    }),
    AuthModule,
    UsersModule,
    ApifyLeadsModule,
    MessagesModule,
    AiConfigModule,
    EvolutionModule,
    OpenaiModule,
    ContactsModule,
    CampaignsModule,
    ConversationsModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      renderPath: '/_not_used_', // Evita procurar index.html se não encontrar o arquivo
    }),
  ],
})
export class AppModule {}
