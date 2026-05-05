import { Controller, Get, Post, Patch, Param, Body, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Get(':id/recipients')
  findRecipients(@Param('id') id: string) {
    return this.svc.findRecipients(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.svc.start(id);
  }

  @Patch(':id/pause')
  pause(@Param('id') id: string) {
    return this.svc.pause(id);
  }

  @Post('upload-media')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req: any, file, cb) => {
        const companyId = req.user.companyId;
        const uploadPath = join(process.cwd(), 'uploads', 'campaigns', companyId);
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
    
    // Constrói a URL acessível
    const protocol = req.protocol;
    const host = req.get('host');
    const companyId = req.user.companyId;
    const mediaUrl = `${protocol}://${host}/uploads/campaigns/${companyId}/${file.filename}`;

    return {
      mediaUrl,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };
  }
}
