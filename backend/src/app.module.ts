import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApifyLeadsModule } from './apify-leads/apify-leads.module';
import { Contact } from './contacts/entities/contact.entity';
import { ApifyLeadSearch } from './apify-leads/entities/apify-lead-search.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'sdr_smart_hub',
      entities: [Contact, ApifyLeadSearch],
      synchronize: process.env.NODE_ENV !== 'production',
      ssl: false,
    }),
    ApifyLeadsModule,
  ],
})
export class AppModule {}
