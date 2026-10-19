import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { CompaniesService } from './companies.service';

// Unlike CompaniesController (command-control only), this exposes a
// company's own details to its authenticated users, scoped by the
// companyId embedded in their JWT — same guard used for phone numbers
// and knowledge bases.
@UseGuards(JwtAuthGuard)
@Controller('company')
export class CompanyDetailsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findOwn(@CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new NotFoundException('No company associated with this account');
    }
    return this.companiesService.findByCompanyId(user.companyId);
  }
}
