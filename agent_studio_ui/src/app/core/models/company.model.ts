export type CompanyStatus = 'active' | 'disabled';

export interface Company {
  id: string;
  companyName: string;
  companyId: string;
  address: string;
  contactNo: string;
  country: string;
  email: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}
