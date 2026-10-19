import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { AddKnowledgeBaseUrlsDto } from './dto/add-urls.dto';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { KnowledgeBasesService } from './knowledge-bases.service';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 10;

@UseGuards(JwtAuthGuard)
@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBasesService: KnowledgeBasesService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateKnowledgeBaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBasesService.create(dto, user.companyId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeBasesService.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeBasesService.findById(id, user.companyId);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeBasesService.disable(id, user.companyId);
  }

  @Post(':id/enable')
  enable(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeBasesService.enable(id, user.companyId);
  }

  @Post(':id/files')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_UPLOAD, {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  addFiles(
    @Param('id') id: string,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES })
        .build({ fileIsRequired: true }),
    )
    files: Array<Express.Multer.File>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBasesService.addFiles(id, files, user.companyId);
  }

  @Post(':id/urls')
  addUrls(
    @Param('id') id: string,
    @Body() dto: AddKnowledgeBaseUrlsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBasesService.addUrls(id, dto.newUrls, user.companyId);
  }

  @Post(':id/files/:fileId/disable')
  disableFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBasesService.disableFile(id, fileId, user.companyId);
  }

  @Post(':id/files/:fileId/enable')
  enableFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBasesService.enableFile(id, fileId, user.companyId);
  }

  @Post(':id/urls/:urlId/disable')
  disableUrl(
    @Param('id') id: string,
    @Param('urlId') urlId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBasesService.disableUrl(id, urlId, user.companyId);
  }

  @Post(':id/urls/:urlId/enable')
  enableUrl(
    @Param('id') id: string,
    @Param('urlId') urlId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledgeBasesService.enableUrl(id, urlId, user.companyId);
  }
}
