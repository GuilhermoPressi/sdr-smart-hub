import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiConfig } from './entities/ai-config.entity';

@Controller('ai-config')
export class AiConfigController {
  constructor(private readonly svc: AiConfigService) {}

  @Get()
  findAll(): Promise<AiConfig[]> {
    return this.svc.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<AiConfig | null> {
    return this.svc.findById(id);
  }

  @Post()
  create(@Body() body: Partial<AiConfig>): Promise<AiConfig> {
    return this.svc.save(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<AiConfig>): Promise<AiConfig> {
    return this.svc.save({ ...body, id });
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<void> {
    return this.svc.delete(id);
  }
}
