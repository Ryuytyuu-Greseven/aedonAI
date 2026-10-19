import { Global, Module } from '@nestjs/common';
import { BusinessDirectoryService } from './services/business-directory.service';
import { CacheService } from './services/cache.service';

/**
 * Global module for values/services shared across feature modules
 * (business ↔ agent routing, business ↔ phone number lookup, etc).
 * Imported once in AppModule; providers are then injectable anywhere.
 */
@Global()
@Module({
  providers: [BusinessDirectoryService, CacheService],
  exports: [BusinessDirectoryService, CacheService],
})
export class CommonModule {}
