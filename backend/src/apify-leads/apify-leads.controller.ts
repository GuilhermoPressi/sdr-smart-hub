import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { ApifyLeadsService } from './apify-leads.service';
import { SearchLeadsDto } from './dto/search-leads.dto';

@Controller('apify-leads')
export class ApifyLeadsController {
  constructor(private readonly service: ApifyLeadsService) {}

  @Post('search')
  async search(@Body() dto: SearchLeadsDto, @Request() req) {
    const user = { sub: 'public', id: 'public', companyId: null };
    return this.service.search(dto, user);
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
