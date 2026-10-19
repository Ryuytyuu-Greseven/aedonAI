import { Injectable, NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service';
import { Company } from '../schemas/company.schema';
import { UsersRepository } from '../repos/users.repository';
import { User } from '../schemas/user.schema';

export interface UserProfile {
  user: User;
  company: Company | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly companiesService: CompaniesService,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.usersRepository.filterById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const company = user.companyId
      ? await this.companiesService.findByCompanyId(user.companyId)
      : null;

    return { user, company };
  }

  async updateName(userId: string, name: string): Promise<User> {
    const updated = await this.usersRepository.setName(userId, name.trim());
    if (!updated) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return updated;
  }
}
