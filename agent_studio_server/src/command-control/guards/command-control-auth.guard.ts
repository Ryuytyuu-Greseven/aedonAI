import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { COMMAND_CONTROL_STRATEGY } from '../strategies/command-control-jwt.strategy';

@Injectable()
export class CommandControlAuthGuard extends AuthGuard(
  COMMAND_CONTROL_STRATEGY,
) {}
