import { Controller, Get, Post, Param, Patch, Body, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll() {
    return this.contactsService.findAll();
  }

  @Get('dashboard/metrics')
  getDashboardMetrics() {
    return this.contactsService.getDashboardMetrics();
  }

  @Get('conversations')
  findConversations() {
    return this.contactsService.findConversations();
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
}
