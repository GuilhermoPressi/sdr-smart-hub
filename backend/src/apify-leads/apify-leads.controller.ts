import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApifyLeadsService } from './apify-leads.service';
import { SearchLeadsDto } from './dto/search-leads.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('apify-leads')
export class ApifyLeadsController {
  constructor(private readonly service: ApifyLeadsService) {}

  @Post('search')
  async search(@Body() dto: SearchLeadsDto, @Request() req) {
    return this.service.search(dto, req.user);
  }

  @Get('searches')
  async getSearches(@Request() req) {
    return this.service.getSearches(req.user);
  }

  @Get('searches/:id')
  async getSearchById(@Param('id') id: string, @Request() req) {
    const result = await this.service.getSearchById(id, req.user);
    if (!result) throw new NotFoundException('Busca não encontrada');
    return result;
  }
}
