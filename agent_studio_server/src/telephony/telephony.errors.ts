import { BadGatewayException } from '@nestjs/common';

/**
 * The provider answered and did not buy the number, so nothing was charged.
 * Still a 502 to the client; unlike a timeout or 5xx, it tells the caller the
 * reservation can be dropped.
 */
export class PurchaseRejectedException extends BadGatewayException {}
