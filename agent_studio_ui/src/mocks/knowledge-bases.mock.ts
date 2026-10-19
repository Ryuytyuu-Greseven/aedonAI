import { KnowledgeBase } from '../app/core/models/knowledge-base.model';

const DAYS = 86400000;

/** Legacy mock data — KnowledgeBaseService now uses the live API. */
export const MOCK_KNOWLEDGE_BASES: KnowledgeBase[] = [
  {
    id: 'kb-support-1',
    name: 'Support Resources',
    status: 'active',
    files: [
      {
        file_id: 'kb-1a',
        filename: 'Support-FAQ.pdf',
        filesize: 248_000,
        cloud_file_path: 'knowledge-bases/support-resources/kb-1a/Support-FAQ.pdf',
        status: 'active',
      },
    ],
    urls: [
      {
        url_id: 'kb-1b',
        label: 'Product help center',
        url: 'https://help.acme.com',
        status: 'active',
      },
    ],
    organizationId: null,
    created_at: new Date(Date.now() - 5 * DAYS).toISOString(),
    updated_at: new Date(Date.now() - 3 * DAYS).toISOString(),
  },
];
