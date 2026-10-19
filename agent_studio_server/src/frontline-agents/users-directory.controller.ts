import { Controller, Get, UseGuards } from '@nestjs/common';
import { CommandControlAuthGuard } from '../command-control/guards/command-control-auth.guard';
import { FrontlineAgentsService } from './frontline-agents.service';

// Platform-wide user directory (every company, admins + agents) is a
// command-control (internal portal) concern, not a per-company admin one,
// so it's gated by the command-control login instead of the regular
// JwtAuthGuard/RolesGuard used by FrontlineAgentsController. Split into its
// own controller because @UseGuards() stacks per-class — a single
// controller can't mix "regular admin JWT" routes with "command-control
// JWT" routes.
@UseGuards(CommandControlAuthGuard)
@Controller('frontline-agents')
export class UsersDirectoryController {
  constructor(
    private readonly frontlineAgentsService: FrontlineAgentsService,
  ) {}

  @Get('users')
  findAllUsers() {
    return this.frontlineAgentsService.findAllUsers();
  }
}
