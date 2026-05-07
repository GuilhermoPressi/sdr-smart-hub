import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignRecipient } from './entities/campaign-recipient.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { EvolutionInstance } from '../evolution/entities/evolution-instance.entity';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignRecipient, EvolutionInstance]),
    EvolutionModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
