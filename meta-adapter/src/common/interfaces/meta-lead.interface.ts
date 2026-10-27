export interface UpsertMetaLeadInput {
  customerId: string;
  pageId: string;
  leadgenId: string;
  formId?: string;
  adId?: string;
  adgroupId?: string;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  customFields?: Record<string, any>;
  metaCreatedAt: Date;
}
