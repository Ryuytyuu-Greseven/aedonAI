export interface LlmUsageModuleOptions {
  mongoUri: string;
  serviceName: string;
  /** Defaults to the database already named in `mongoUri`; set only to override it. */
  dbName?: string;
}
