import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Get(':id/recipients')
  findRecipients(@Param('id') id: string) {
    return this.svc.findRecipients(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.svc.start(id);
  }

  @Patch(':id/pause')
  pause(@Param('id') id: string) {
    return this.svc.pause(id);
  }
}
