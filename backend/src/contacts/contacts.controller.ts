import { Controller, Get, Post, Param, Patch, Body, UseGuards, UseInterceptors, UploadedFile, Req, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/auth.guard';

import { TenantHelper } from '../common/utils/tenant.utils';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  private getCompanyId(req: any): string {
    return TenantHelper.getCompanyIdOrThrow(req.user);
  }

  @Get()
  findAll(@Req() req) {
    return this.contactsService.findAll(this.getCompanyId(req));
  }

  @Get('dashboard/metrics')
  getDashboardMetrics(@Req() req) {
    const companyId = this.getCompanyId(req);
    console.log('[ContactsController] Dashboard solicitado para companyId:', companyId);
    return this.contactsService.getDashboardMetrics(companyId);
  }

  @Get('conversations')
  findConversations(@Req() req) {
    return this.contactsService.findConversations(this.getCompanyId(req));
  }

  @Post()
  create(@Req() req, @Body() data: any) {
    return this.contactsService.create({
      ...data,
      companyId: this.getCompanyId(req),
    });
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importContacts(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const mapping = JSON.parse(body.mapping || '{}');
    const config = {
      companyId: this.getCompanyId(req),
      tag: body.tag,
      stage: body.stage,
      ignoreDuplicates: body.ignoreDuplicates === 'true',
      updateExisting: body.updateExisting === 'true',
      createWithoutName: body.createWithoutName === 'true',
    };

    return this.contactsService.importContacts(file.buffer, mapping, config);
  }

  @Patch('bulk')
  async updateBulk(@Req() req, @Body() body: { contactIds: string[], patch: any }) {
    return this.contactsService.updateBulk(body.contactIds, body.patch, this.getCompanyId(req));
  }

  @Delete('bulk')
  async deleteBulk(@Req() req, @Body() body: { contactIds: string[] }) {
    return this.contactsService.deleteBulk(body.contactIds, this.getCompanyId(req));
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.contactsService.findOne(id, this.getCompanyId(req));
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.contactsService.update(id, data, this.getCompanyId(req));
  }
}
