import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatePropertyInput, Property, UpdatePropertyInput } from '../models/property.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly api = inject(ApiService);

  createProperty(agentId: string, input: CreatePropertyInput): Observable<Property> {
    return this.api.createProperty(agentId, input);
  }

  getProperties(agentId: string): Observable<Property[]> {
    return this.api.getProperties(agentId);
  }

  getProperty(id: string): Observable<Property> {
    return this.api.getProperty(id);
  }

  updateProperty(id: string, input: UpdatePropertyInput): Observable<Property> {
    return this.api.updateProperty(id, input);
  }

  deleteProperty(id: string): Observable<void> {
    return this.api.deleteProperty(id);
  }
}
