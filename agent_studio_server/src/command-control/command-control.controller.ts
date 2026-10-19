import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandControlService } from './command-control.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CommandControlLoginDto } from './dto/login.dto';
import { CommandControlAuthGuard } from './guards/command-control-auth.guard';

@Controller('command_control')
export class CommandControlController {
  constructor(private readonly commandControlService: CommandControlService) {}

  @Post('login')
  login(@Body() dto: CommandControlLoginDto) {
    return this.commandControlService.login(dto.email, dto.password);
  }

  @UseGuards(CommandControlAuthGuard)
  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.commandControlService.createAdmin(dto);
  }
}
