import { Req } from '@nestjs/common';
import { TenantHelper } from '../common/utils/tenant.utils';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // Apenas admin pode acessar esse controller inteiro
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private getCompanyId(req: any): string {
    return TenantHelper.getCompanyIdOrThrow(req.user);
  }

  @Post()
  create(@Req() req, @Body() data: any) {
    return this.usersService.create({ ...data, companyId: this.getCompanyId(req) });
  }

  @Get()
  findAll(@Req() req) {
    return this.usersService.findAll(this.getCompanyId(req));
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data, this.getCompanyId(req));
  }

  @Patch(':id/deactivate')
  deactivate(@Req() req, @Param('id') id: string) {
    return this.usersService.deactivate(id, this.getCompanyId(req));
  }
}
