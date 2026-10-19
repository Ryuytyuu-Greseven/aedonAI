// Augments Express's Request with the per-request trace id RequestLoggerMiddleware
// assigns at the start of every request. Declared globally since Express's own
// Request type is used directly (not wrapped) throughout the app.
declare global {
  namespace Express {
    interface Request {
      /** Generated once per request by RequestLoggerMiddleware; use it in any log tied to this request. */
      apiTraceId: string;
    }
  }
}

export {};
