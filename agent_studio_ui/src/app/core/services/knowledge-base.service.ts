import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import {
  KnowledgeBase,
  NewKnowledgeBaseFileInput,
  NewKnowledgeBaseUrlInput,
} from '../models/knowledge-base.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  constructor(private readonly api: ApiService) {}

  getKnowledgeBases(): Observable<KnowledgeBase[]> {
    return this.api.getKnowledgeBases();
  }

  getKnowledgeBase(id: string): Observable<KnowledgeBase> {
    return this.api.getKnowledgeBase(id);
  }

  createKnowledgeBase(name: string): Observable<KnowledgeBase> {
    const trimmed = name.trim();
    if (!trimmed) {
      return throwError(() => new Error('Name is required'));
    }
    return this.api.createKnowledgeBase({ name: trimmed });
  }

  addFiles(id: string, files: NewKnowledgeBaseFileInput[]): Observable<KnowledgeBase> {
    if (files.length === 0) {
      return throwError(() => new Error('At least one file is required'));
    }
    return this.api.addKnowledgeBaseFiles(id, files);
  }

  addUrls(id: string, urls: NewKnowledgeBaseUrlInput[]): Observable<KnowledgeBase> {
    if (urls.length === 0) {
      return throwError(() => new Error('At least one URL is required'));
    }
    return this.api.addKnowledgeBaseUrls(id, {
      newUrls: urls.map((u) => ({ label: u.label, url: u.url })),
    });
  }

  disableFile(id: string, fileId: string): Observable<KnowledgeBase> {
    return this.api.disableKnowledgeBaseFile(id, fileId);
  }

  enableFile(id: string, fileId: string): Observable<KnowledgeBase> {
    return this.api.enableKnowledgeBaseFile(id, fileId);
  }

  disableUrl(id: string, urlId: string): Observable<KnowledgeBase> {
    return this.api.disableKnowledgeBaseUrl(id, urlId);
  }

  enableUrl(id: string, urlId: string): Observable<KnowledgeBase> {
    return this.api.enableKnowledgeBaseUrl(id, urlId);
  }

  disableKnowledgeBase(id: string): Observable<KnowledgeBase> {
    return this.api.disableKnowledgeBase(id);
  }

  enableKnowledgeBase(id: string): Observable<KnowledgeBase> {
    return this.api.enableKnowledgeBase(id);
  }
}
