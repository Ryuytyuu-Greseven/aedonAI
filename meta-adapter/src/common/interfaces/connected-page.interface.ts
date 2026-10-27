export interface UpsertConnectedPageInput {
  customerId: string;
  pageId: string;
  pageName?: string;
  accessToken: string;
  isActive?: boolean;
}
