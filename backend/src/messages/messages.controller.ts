import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('contact/:contactId')
  findByContact(
    @Param('contactId') contactId: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.findByContact(contactId, take);
  }

  @Post('contact/:contactId/read')
  markAsRead(@Param('contactId') contactId: string) {
    return this.messagesService.markAsRead(contactId);
  }
}
