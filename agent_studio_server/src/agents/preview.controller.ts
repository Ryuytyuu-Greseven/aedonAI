import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PreviewCallDto } from './dto/preview-call.dto';
import { PreviewService } from './preview.service';

@UseGuards(JwtAuthGuard)
@Controller('preview')
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  @Post('call')
  call(@Body() dto: PreviewCallDto) {
    return this.previewService.call(dto);
  }

  @Post('chat')
  chat(@Body() dto: PreviewCallDto) {
    return this.previewService.chat(dto);
  }

  @Post('webcall')
  webcall(@Body() dto: PreviewCallDto) {
    return this.previewService.webcall(dto);
  }
}
