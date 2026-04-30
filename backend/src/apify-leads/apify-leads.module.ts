import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApifyLeadsController } from './apify-leads.controller';
import { ApifyLeadsService } from './apify-leads.service';
import { ApifyService } from './apify.service';
import { ApifyLeadSearch } from './entities/apify-lead-search.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApifyLeadSearch, Contact]),
    AuthModule,
  ],
  controllers: [ApifyLeadsController],
  providers: [ApifyLeadsService, ApifyService],
})
export class ApifyLeadsModule {}
