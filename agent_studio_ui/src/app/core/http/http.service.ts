import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api-config';

export interface HttpRequestOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: HttpParams | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>;
  withCredentials?: boolean;
}

@Injectable({ providedIn: 'root' })
export class HttpService {
  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, options?: HttpRequestOptions): Observable<T> {
    return this.http.get<T>(this.resolve(path), options);
  }

  post<T>(path: string, body: unknown = null, options?: HttpRequestOptions): Observable<T> {
    return this.http.post<T>(this.resolve(path), body, options);
  }

  put<T>(path: string, body: unknown = null, options?: HttpRequestOptions): Observable<T> {
    return this.http.put<T>(this.resolve(path), body, options);
  }

  /** Alias for PATCH — partial updates. */
  update<T>(path: string, body: unknown = null, options?: HttpRequestOptions): Observable<T> {
    return this.patch<T>(path, body, options);
  }

  patch<T>(path: string, body: unknown = null, options?: HttpRequestOptions): Observable<T> {
    return this.http.patch<T>(this.resolve(path), body, options);
  }

  delete<T>(path: string, options?: HttpRequestOptions): Observable<T> {
    return this.http.delete<T>(this.resolve(path), options);
  }

  /** Binary download (e.g. report `.xlsx`). */
  getBlob(path: string, options?: HttpRequestOptions): Observable<Blob> {
    return this.http.get(this.resolve(path), { ...options, responseType: 'blob' });
  }

  private resolve(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${normalized}`;
  }
}
