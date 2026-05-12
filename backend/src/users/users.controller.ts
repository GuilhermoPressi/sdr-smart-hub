import { Controller, Get, Post, Body, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
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
