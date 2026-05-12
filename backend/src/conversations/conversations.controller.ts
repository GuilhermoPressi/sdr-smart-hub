import { TenantHelper } from '../common/utils/tenant.utils';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  findAll(@Req() req) {
    const companyId = TenantHelper.getCompanyIdOrThrow(req.user);
    return this.service.findAll(companyId);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() data: any) {
    const companyId = TenantHelper.getCompanyIdOrThrow(req.user);
    return this.service.update(id, data, companyId);
  }

  @Patch(':id/read')
  markAsRead(@Req() req, @Param('id') id: string) {
    const companyId = TenantHelper.getCompanyIdOrThrow(req.user);
    return this.service.resetUnread(id, companyId);
  }
}
