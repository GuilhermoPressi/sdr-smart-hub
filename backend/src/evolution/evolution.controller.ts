import { Controller, Get, Post, Delete, Param, Body, Logger } from '@nestjs/common';
import { EvolutionService } from './evolution.service';

@Controller('evolution')
export class EvolutionController {
  private readonly logger = new Logger(EvolutionController.name);

  constructor(private readonly evo: EvolutionService) {}

  /**
   * POST /api/v1/evolution/instances
   * Creates a new WhatsApp instance and returns the QR code
   */
  @Post('instances')
  async createInstance(
    @Body() body: { instanceName: string; webhookUrl?: string },
  ) {
    this.logger.log(`Criando instância: ${body.instanceName}`);
    return this.evo.createInstance(body.instanceName, body.webhookUrl);
  }

  /**
   * GET /api/v1/evolution/instances
   * Lists all registered instances
   */
  @Get('instances')
  async listInstances() {
    return this.evo.listInstances();
  }

  /**
   * GET /api/v1/evolution/instances/:name/qrcode
   * Generates a new QR code for pairing
   */
  @Get('instances/:name/qrcode')
  async getQrCode(@Param('name') name: string) {
    return this.evo.getQrCode(name);
  }

  /**
   * GET /api/v1/evolution/instances/:name/status
   * Returns the current connection state
   */
  @Get('instances/:name/status')
  async getStatus(@Param('name') name: string) {
    return this.evo.getConnectionState(name);
  }

  /**
   * DELETE /api/v1/evolution/instances/:name
   * Deletes an instance
   */
  @Delete('instances/:name')
  async deleteInstance(@Param('name') name: string) {
    return this.evo.deleteInstance(name);
  }

  /**
   * POST /api/v1/evolution/send-text
   * Send a text message via WhatsApp
   */
  @Post('send-text')
  async sendText(
    @Body() body: { instanceName: string; phone: string; text: string },
  ) {
    return this.evo.sendText(body.instanceName, body.phone, body.text);
  }
}
