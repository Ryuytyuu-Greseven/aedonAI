import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import { hashPassword } from '../common/utils/password.util';
import { CommandControlRepository } from '../repos/command-control.repository';
import { CompaniesRepository } from '../repos/companies.repository';
import { UsersRepository } from '../repos/users.repository';
import { User } from '../schemas/user.schema';
import { CreateAdminDto } from './dto/create-admin.dto';

export interface CommandControlSession {
  email: string;
  token: string;
}

interface CommandControlJwtPayload {
  sub: string;
  email: string;
  jti: string;
}

const DEFAULT_EMAIL = 'rukmeshpilla@lyreai.life';
const DEFAULT_PASSWORD = 'Peterparker@93223';

/** Login for the internal command-control portal, separate from the regular company-scoped users. */
@Injectable()
export class CommandControlService {
  constructor(
    private readonly commandControlRepository: CommandControlRepository,
    private readonly usersRepository: UsersRepository,
    private readonly companiesRepository: CompaniesRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<CommandControlSession> {
    const user = await this.commandControlRepository.filterByEmail(
      email.toLowerCase().trim(),
    );

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: CommandControlJwtPayload = {
      sub: user.id as string,
      email: user.email,
      jti: randomUUID(),
    };
    const token = this.jwtService.sign(payload);

    return { email: user.email, token };
  }

  /** Creates a new admin (role: "admin") under the given company. */
  async createAdmin(dto: CreateAdminDto): Promise<User> {
    const company = await this.companiesRepository.filterByCompanyId(
      dto.companyId,
    );
    if (!company) {
      throw new NotFoundException(`Company ${dto.companyId} not found`);
    }

    const passwordHash = await hashPassword(dto.password);
    try {
      return await this.usersRepository.create({
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        name: dto.name.trim(),
        role: 'admin',
        companyId: dto.companyId,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async ensureSeedUser(): Promise<void> {
    const email = this.config
      .get<string>('COMMAND_CONTROL_EMAIL', DEFAULT_EMAIL)
      .toLowerCase()
      .trim();
    const existing = await this.commandControlRepository.filterByEmail(email);
    if (existing) {
      return;
    }
    const password = this.config.get<string>(
      'COMMAND_CONTROL_PASSWORD',
      DEFAULT_PASSWORD,
    );
    const passwordHash = await hashPassword(password);
    await this.commandControlRepository.create({ email, passwordHash });
  }
}
