import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  findAll(@Req() req) {
    const companyId = req.user.companyId || 'default-company';
    return this.service.findAll(companyId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.service.resetUnread(id);
  }
}
