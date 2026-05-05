import { Controller, Get, Post, Param, Patch, Body, UseGuards, UseInterceptors, UploadedFile, Req, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(@Req() req) {
    return this.contactsService.findAll(req.user.companyId);
  }

  @Get('dashboard/metrics')
  getDashboardMetrics(@Req() req) {
    console.log('[ContactsController] Dashboard solicitado para companyId:', req.user.companyId);
    return this.contactsService.getDashboardMetrics(req.user.companyId);
  }

  @Get('conversations')
  findConversations(@Req() req) {
    return this.contactsService.findConversations(req.user.companyId);
  }

  @Post()
  create(@Req() req, @Body() data: any) {
    return this.contactsService.create({
      ...data,
      companyId: req.user.companyId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.contactsService.update(id, data);
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
      companyId: req.user.companyId,
      tag: body.tag,
      stage: body.stage,
      ignoreDuplicates: body.ignoreDuplicates === 'true',
      updateExisting: body.updateExisting === 'true',
      createWithoutName: body.createWithoutName === 'true',
    };

    return this.contactsService.importContacts(file.buffer, mapping, config);
  }

  @Delete('bulk')
  async deleteBulk(@Req() req, @Body() body: { contactIds: string[] }) {
    return this.contactsService.deleteBulk(body.contactIds, req.user.companyId);
  }
}
