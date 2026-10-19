import { NotFoundException } from '@nestjs/common';

/**
 * Guards a company-owned resource against cross-company access: throws if
 * the requester's companyId doesn't match the resource's companyId. Use for
 * any resource scoped to a company (frontline agents, knowledge bases, etc).
 */
export function assertSameCompany(
  requesterCompanyId: string | null,
  resourceCompanyId: string | null,
  notFoundMessage: string,
): void {
  if (requesterCompanyId !== resourceCompanyId) {
    throw new NotFoundException(notFoundMessage);
  }
}
