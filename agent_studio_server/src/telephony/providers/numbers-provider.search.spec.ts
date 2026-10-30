/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { BadGatewayException } from '@nestjs/common';
import axios from 'axios';
import { PurchaseRejectedException } from '../telephony.errors';
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

describe('Exotel listOwned', () => {
  afterEach(() => jest.restoreAllMocks());

  const exo = (sid: string, phone: string) => ({
    sid,
    phone_number: phone,
    capabilities: { voice: true, sms: false },
  });

  it('pages until a short page', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          page: 0,
          page_size: 2,
          incoming_phone_numbers: [
            exo('a', '+919000000001'),
            exo('b', '09000000002'),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          page: 1,
          page_size: 2,
          incoming_phone_numbers: [exo('c', '+919000000003')],
        },
      });
    jest.spyOn(axios, 'create').mockReturnValue({ get } as any);

    const owned = await new ExotelNumbersProvider(config).listOwned();

    expect(owned.map((n) => n.e164)).toEqual([
      '+919000000001',
      '+919000000002',
      '+919000000003',
    ]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('refuses a partial list when paging params are ignored', async () => {
    const fullPage = {
      data: {
        page: 0,
        page_size: 2,
        incoming_phone_numbers: [
          exo('a', '+919000000001'),
          exo('b', '+919000000002'),
        ],
      },
    };
    jest
      .spyOn(axios, 'create')
      .mockReturnValue({ get: jest.fn().mockResolvedValue(fullPage) } as any);

    await expect(
      new ExotelNumbersProvider(config).listOwned(),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('Twilio purchase errors', () => {
  const twilioWithCreate = (create: jest.Mock) => {
    const provider = new TwilioNumbersProvider({
      get: (key: string) => ({ TWILIO_WEBHOOK_URL: 'https://gw.test' })[key],
      getOrThrow: () => 'https://gw.test',
    } as any);
    (provider as any).client = { incomingPhoneNumbers: { create } };
    return provider;
  };

  it('a Twilio 4xx is a definite rejection', async () => {
    const provider = twilioWithCreate(
      jest.fn().mockRejectedValue({ status: 400, code: 21404 }),
    );
    await expect(
      provider.purchase('+14155550199', { friendlyName: 'x' }),
    ).rejects.toBeInstanceOf(PurchaseRejectedException);
  });

  it('a Twilio 5xx / timeout is not', async () => {
    const provider = twilioWithCreate(
      jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    );
    const error = await provider
      .purchase('+14155550199', { friendlyName: 'x' })
      .catch((e: Error) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error).not.toBeInstanceOf(PurchaseRejectedException);
  });
});
