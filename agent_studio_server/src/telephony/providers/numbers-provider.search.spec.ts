/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { BadGatewayException } from '@nestjs/common';
import axios from 'axios';
import { SearchNumbersQuery } from '../telephony.types';
import { ExotelNumbersProvider } from './exotel-numbers.provider';
import { TwilioNumbersProvider } from './twilio-numbers.provider';

const env: Record<string, string> = {
  EXOTEL_API_KEY: 'key',
  EXOTEL_API_TOKEN: 'token',
  EXOTEL_ACCOUNT_SID: 'acct',
};
const config = { get: (key: string) => env[key] } as any;

const query: SearchNumbersQuery = {
  isoCountry: 'IN',
  type: 'mobile',
  limit: 20,
};

describe('number search — nothing found', () => {
  afterEach(() => jest.restoreAllMocks());

  it('Exotel 404 is an empty result', async () => {
    jest.spyOn(axios, 'create').mockReturnValue({
      get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
    } as any);
    await expect(
      new ExotelNumbersProvider(config).search(query),
    ).resolves.toEqual([]);
  });

  it('Exotel 5xx is a generic error without provider details', async () => {
    jest.spyOn(axios, 'create').mockReturnValue({
      get: jest.fn().mockRejectedValue({
        response: { status: 500, data: { message: 'acct supersoul2 broke' } },
      }),
    } as any);
    const error = await new ExotelNumbersProvider(config)
      .search(query)
      .catch((e: Error) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as Error).message).not.toMatch(/exotel|supersoul2/i);
  });

  it('Twilio 404 is an empty result', async () => {
    const provider = new TwilioNumbersProvider(config);
    const list = jest.fn().mockRejectedValue({ status: 404 });
    (provider as any).client = {
      availablePhoneNumbers: () => ({ local: { list }, tollFree: { list } }),
    };
    await expect(
      provider.search({ ...query, isoCountry: 'US', type: 'local' }),
    ).resolves.toEqual([]);
  });
});
