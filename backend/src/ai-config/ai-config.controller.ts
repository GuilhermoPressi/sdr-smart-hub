import { Controller, Get, Post, Put, Patch, Delete, Body, Param } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiConfig } from './entities/ai-config.entity';

@Controller('ai-config')
export class AiConfigController {
  constructor(private readonly svc: AiConfigService) {}

  @Get()
  findAll(): Promise<AiConfig[]> {
    return this.svc.findAll();
  }

  @Get('active')
  findActive(): Promise<AiConfig | null> {
    return this.svc.findActive();
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

  @Patch(':id/activate')
  activate(@Param('id') id: string): Promise<AiConfig> {
    return this.svc.activate(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string): Promise<AiConfig> {
    return this.svc.deactivate(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.svc.delete(id);
    return { success: true, deletedId: id };
  }
}
