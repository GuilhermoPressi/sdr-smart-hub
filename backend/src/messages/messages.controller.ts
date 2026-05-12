import { Req } from '@nestjs/common';
import { TenantHelper } from '../common/utils/tenant.utils';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  private getCompanyId(req: any): string {
    return TenantHelper.getCompanyIdOrThrow(req.user);
  }

  @Get('contact/:contactId')
  findByContact(
    @Req() req,
    @Param('contactId') contactId: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.findByContact(contactId, this.getCompanyId(req), take);
  }

  @Get('conversation/:conversationId')
  findByConversation(
    @Req() req,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.findByConversation(conversationId, this.getCompanyId(req), take);
  }

  @Post('contact/:contactId/read')
  markAsRead(@Req() req, @Param('contactId') contactId: string) {
    return this.messagesService.markAsRead(contactId, this.getCompanyId(req));
  }
}
