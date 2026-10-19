import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { UpdateProfileNameDto } from './dto/update-profile-name.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('profile/name')
  updateProfileName(
    @Body() dto: UpdateProfileNameDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateName(user.userId, dto.name);
  }
}
