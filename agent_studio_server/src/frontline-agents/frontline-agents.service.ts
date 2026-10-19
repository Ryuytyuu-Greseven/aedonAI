import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertSameCompany } from '../common/utils/company-scope.util';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import { hashPassword } from '../common/utils/password.util';
import { UsersRepository } from '../repos/users.repository';
import { User } from '../schemas/user.schema';
import { CreateFrontlineAgentDto } from './dto/create-frontline-agent.dto';

@Injectable()
export class FrontlineAgentsService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(
    dto: CreateFrontlineAgentDto,
    requesterCompanyId: string | null,
  ): Promise<User> {
    const passwordHash = await hashPassword(dto.password);
    try {
      return await this.usersRepository.create({
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        name: dto.name.trim(),
        role: 'agent',
        companyId: requesterCompanyId,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async findAll(requesterCompanyId: string | null): Promise<User[]> {
    return this.usersRepository.filterByRole('agent', requesterCompanyId);
  }

  /** Lists all users regardless of role (admins and agents). */
  async findAllUsers(): Promise<User[]> {
    return this.usersRepository.filterAll();
  }

  async disable(id: string, requesterCompanyId: string | null): Promise<User> {
    await this.findAgentById(id, requesterCompanyId);
    const updated = await this.usersRepository.setDisabled(id, true);
    if (!updated) {
      throw new NotFoundException(`Frontline agent ${id} not found`);
    }
    return updated;
  }

  async enable(id: string, requesterCompanyId: string | null): Promise<User> {
    await this.findAgentById(id, requesterCompanyId);
    const updated = await this.usersRepository.setDisabled(id, false);
    if (!updated) {
      throw new NotFoundException(`Frontline agent ${id} not found`);
    }
    return updated;
  }

  async updateName(
    id: string,
    name: string,
    requesterCompanyId: string | null,
  ): Promise<User> {
    await this.findAgentById(id, requesterCompanyId);
    const updated = await this.usersRepository.setName(id, name.trim());
    if (!updated) {
      throw new NotFoundException(`Frontline agent ${id} not found`);
    }
    return updated;
  }

  /** Resets the password for any user by id (admin or agent) within the requester's own company. */
  async resetPassword(
    id: string,
    newPassword: string,
    requesterCompanyId: string | null,
  ): Promise<void> {
    const user = await this.usersRepository.filterById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    assertSameCompany(
      requesterCompanyId,
      user.companyId,
      `User ${id} not found`,
    );

    const passwordHash = await hashPassword(newPassword);
    await this.usersRepository.setPasswordHash(id, passwordHash);
  }

  private async findAgentById(
    id: string,
    requesterCompanyId: string | null,
  ): Promise<User> {
    const user = await this.usersRepository.filterById(id);
    if (!user || user.role !== 'agent') {
      throw new NotFoundException(`Frontline agent ${id} not found`);
    }
    assertSameCompany(
      requesterCompanyId,
      user.companyId,
      `Frontline agent ${id} not found`,
    );
    return user;
  }
}
