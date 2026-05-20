import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TenantHelper } from '../common/utils/tenant.utils';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  private getCompanyId(req: any): string {
    return TenantHelper.getCompanyIdOrThrow(req.user);
  }

  @Get()
  findAll(@Req() req) {
    return this.svc.findAll(this.getCompanyId(req));
  }

  @Get(':id')
  findById(@Req() req, @Param('id') id: string) {
    return this.svc.findById(id, this.getCompanyId(req));
  }

  @Get(':id/recipients')
  findRecipients(@Req() req, @Param('id') id: string) {
    return this.svc.findRecipients(id, this.getCompanyId(req));
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.svc.create(body, req.user);
  }

  @Patch(':id/start')
  start(@Req() req, @Param('id') id: string) {
    return this.svc.start(id, this.getCompanyId(req));
  }

  @Patch(':id/pause')
  pause(@Req() req, @Param('id') id: string) {
    return this.svc.pause(id, this.getCompanyId(req));
  }

  @Post('upload-media')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req: any, file, cb) => {
        const companyId = TenantHelper.getCompanyIdOrThrow(req.user);
        const uploadPath = join(process.cwd(), 'uploads', 'campaigns', String(companyId));
        if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4',
        'audio/mpeg', 'audio/ogg', 'audio/wav',
        'application/pdf'
      ];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Tipo de arquivo não permitido'), false);
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  }))
  uploadMedia(@Req() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    
    // Constrói a URL acessível (com api/v1 pois o ServeStatic herda o Global Prefix)
    const host = req.get('host');
    const companyId = this.getCompanyId(req);
    const protocol = req.protocol === 'http' && host.includes('api.sdr') ? 'https' : req.protocol;
    const mediaUrl = `${protocol}://${host}/api/v1/uploads/campaigns/${companyId}/${file.filename}`;

    console.log(`[CampaignsController] Arquivo salvo em: ${file.path}`);
    console.log(`[CampaignsController] URL pública gerada: ${mediaUrl}`);

    return {
      mediaUrl,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };
  }
}
