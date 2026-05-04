import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiConfig } from './entities/ai-config.entity';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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
  async update(@Param('id') id: string, @Body() body: Partial<AiConfig>): Promise<AiConfig> {
    console.log(`[AiConfigController] PUT /:id -> recebido id: ${id}`);
    console.log(`[AiConfigController] Payload completo recebido:`, JSON.stringify(body, null, 2));
    const result = await this.svc.save({ ...body, id });
    console.log(`[AiConfigController] Resultado retornado pelo svc.save:`, JSON.stringify(result, null, 2));
    return result;
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

  @Post(':id/test-chat')
  async testChat(
    @Param('id') id: string,
    @Body() body: { message: string; history: any[]; stage: string },
  ) {
    return this.svc.testChat(id, body);
  }
}
