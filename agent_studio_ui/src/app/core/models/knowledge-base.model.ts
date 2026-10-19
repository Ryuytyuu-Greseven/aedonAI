export type KnowledgeBaseStatus = 'active' | 'disabled';
export type KnowledgeBaseItemStatus = 'active' | 'disabled';
export type KnowledgeBaseEntryKind = 'file' | 'url';

export interface KnowledgeBaseFile {
  file_id: string;
  filename: string;
  filesize: number;
  cloud_file_path: string;
  status: KnowledgeBaseItemStatus;
}

export interface KnowledgeBaseUrl {
  url_id: string;
  label: string;
  url: string;
  status: KnowledgeBaseItemStatus;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  status: KnowledgeBaseStatus;
  files: KnowledgeBaseFile[];
  urls: KnowledgeBaseUrl[];
  organizationId: string | null;
  created_at: string;
  updated_at: string;
}

/** Unified view model for the presentational entry editor. */
export interface KnowledgeBaseEntry {
  id: string;
  kind: KnowledgeBaseEntryKind;
  name: string;
  url?: string;
  file_type?: string;
  file_size_bytes?: number;
  uploaded_at: string;
  status: KnowledgeBaseItemStatus;
}

export interface NewKnowledgeBaseFileInput {
  file: File;
  filename: string;
  filesize: number;
}

export interface NewKnowledgeBaseUrlInput {
  label: string;
  url: string;
}

export function knowledgeBaseItemCount(base: KnowledgeBase): number {
  return base.files.length + base.urls.length;
}

export function knowledgeBaseToEntries(base: KnowledgeBase): KnowledgeBaseEntry[] {
  const files: KnowledgeBaseEntry[] = base.files.map((f) => ({
    id: f.file_id,
    kind: 'file',
    name: f.filename,
    file_type: f.filename.includes('.') ? f.filename.split('.').pop()!.toLowerCase() : '',
    file_size_bytes: f.filesize,
    uploaded_at: base.updated_at,
    status: f.status,
  }));
  const urls: KnowledgeBaseEntry[] = base.urls.map((u) => ({
    id: u.url_id,
    kind: 'url',
    name: u.label,
    url: u.url,
    uploaded_at: base.updated_at,
    status: u.status,
  }));
  return [...files, ...urls];
}

export function knowledgeBaseEntryNameExists(
  entries: KnowledgeBaseEntry[],
  name: string,
  excludeId?: string,
): boolean {
  return entries.some(
    (e) => e.name.toLowerCase() === name.trim().toLowerCase() && e.id !== excludeId && e.status === 'active',
  );
}

export function knowledgeBaseNameExists(bases: KnowledgeBase[], name: string, excludeId?: string): boolean {
  return bases.some((b) => b.name.toLowerCase() === name.trim().toLowerCase() && b.id !== excludeId);
}
