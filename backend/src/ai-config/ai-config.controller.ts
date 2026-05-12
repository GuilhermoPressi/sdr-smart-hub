import { Req } from '@nestjs/common';
import { TenantHelper } from '../common/utils/tenant.utils';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('ai-config')
export class AiConfigController {
  constructor(private readonly svc: AiConfigService) {}

  private getCompanyId(req: any): string {
    return TenantHelper.getCompanyIdOrThrow(req.user);
  }

  @Get()
  findAll(@Req() req): Promise<AiConfig[]> {
    return this.svc.findAll(this.getCompanyId(req));
  }

  @Get('active')
  findActive(@Req() req): Promise<AiConfig | null> {
    return this.svc.findActive(this.getCompanyId(req));
  }

  @Get(':id')
  findById(@Req() req, @Param('id') id: string): Promise<AiConfig | null> {
    return this.svc.findById(id, this.getCompanyId(req));
  }

  @Post()
  create(@Req() req, @Body() body: Partial<AiConfig>): Promise<AiConfig> {
    return this.svc.save({ ...body, companyId: this.getCompanyId(req) });
  }

  @Put(':id')
  async update(@Req() req, @Param('id') id: string, @Body() body: Partial<AiConfig>): Promise<AiConfig> {
    const companyId = this.getCompanyId(req);
    return this.svc.save({ ...body, id, companyId });
  }

  @Patch(':id/activate')
  activate(@Req() req, @Param('id') id: string): Promise<AiConfig> {
    return this.svc.activate(id, this.getCompanyId(req));
  }

  @Patch(':id/deactivate')
  deactivate(@Req() req, @Param('id') id: string): Promise<AiConfig> {
    return this.svc.deactivate(id, this.getCompanyId(req));
  }

  @Delete(':id')
  async delete(@Req() req, @Param('id') id: string) {
    await this.svc.delete(id, this.getCompanyId(req));
    return { success: true, deletedId: id };
  }

  @Post(':id/test-chat')
  async testChat(
    @Param('id') id: string,
    @Body() body: { message: string; history: any[]; stage: string },
  ) {
    return this.svc.testChat(id, body);
  }
}
