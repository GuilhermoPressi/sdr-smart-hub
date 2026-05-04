import { Controller, Post, Get, Param, Body, NotFoundException, Request, UseGuards } from '@nestjs/common';
import { ApifyLeadsService } from './apify-leads.service';
import { SearchLeadsDto } from './dto/search-leads.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('apify-leads')
export class ApifyLeadsController {
  constructor(private readonly service: ApifyLeadsService) {}

  @Post('search')
  async search(@Body() dto: SearchLeadsDto) {
    const user = { sub: 'public', id: 'public', companyId: null };
    return this.service.search(dto, user);
  }

  @Post('import/:searchId')
  async importLeads(@Param('searchId') searchId: string) {
    const user = { sub: 'public', id: 'public', companyId: null };
    return this.service.importLeads(searchId, user);
  }

  @Get('searches')
  async getSearches() {
    const user = { sub: 'public', id: 'public', companyId: null };
    return this.service.getSearches(user);
  }

  @Get('searches/:id')
  async getSearchById(@Param('id') id: string) {
    const user = { sub: 'public', id: 'public', companyId: null };
    const result = await this.service.getSearchById(id, user);
    if (!result) throw new NotFoundException('Busca não encontrada');
    return result;
  }
}
