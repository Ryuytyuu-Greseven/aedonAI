/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { model } from 'mongoose';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { PhoneNumberSchema } from '../schemas/phone-number.schema';
import { PurchaseRejectedException } from '../telephony/telephony.errors';
import { TelephonyNumbersRegistry } from '../telephony/telephony-numbers.registry';
import { toE164 } from '../telephony/utils/e164.util';
import { PhoneNumbersService } from './phone-numbers.service';

const admin: AuthenticatedUser = {
  userId: 'u1',
  email: 'admin@acme.test',
  name: 'Admin',
  role: 'admin',
  companyId: 'c1',
};

const purchased = {
  provider_sid: 'PN123',
  e164: '+14155550199',
  friendly_name: '(415) 555-0199',
  capabilities: { voice: true, sms: true, mms: false },
  monthly_price: null,
  currency: null,
  inbound_configured: true,
};

function setup() {
  const repo = {
    createProvisioning: jest.fn().mockResolvedValue({ _id: 'pn-doc' }),
    markPurchased: jest
      .fn()
      .mockResolvedValue({ id: 'pn-doc', status: 'Available' }),
    deleteById: jest.fn().mockResolvedValue(undefined),
    findStaleProvisioning: jest.fn().mockResolvedValue([]),
    deleteProvisioning: jest.fn().mockResolvedValue(undefined),
    filterById: jest.fn(),
    markReleased: jest.fn().mockResolvedValue({ status: 'Released' }),
    updateAssignedAgent: jest.fn().mockResolvedValue({ assigned_agent: null }),
  };
  const twilio = {
    name: 'twilio',
    search: jest.fn().mockResolvedValue([]),
    purchase: jest.fn().mockResolvedValue(purchased),
    release: jest.fn().mockResolvedValue(undefined),
    listOwned: jest.fn().mockResolvedValue([]),
  };
  const exotel = {
    ...twilio,
    name: 'exotel',
    search: jest.fn(),
    listOwned: jest.fn().mockResolvedValue([]),
  };
  const registry = new TelephonyNumbersRegistry(twilio as any, exotel as any);
  const service = new PhoneNumbersService(repo as any, registry);
  (service as any).saveRetryDelaysMs = [0, 0];
  return { service, repo, twilio, exotel };
}

const purchaseDto = {
  country: 'US',
  phone_number: '+14155550199',
  number_type: 'local' as const,
  label: 'Sales line',
};

describe('PhoneNumbersService.searchAvailable', () => {
  it('routes US to Twilio with the default type', async () => {
    const { service, twilio, exotel } = setup();
    const result = await service.searchAvailable({
      country: 'US',
      areaCode: '415',
    });
    expect(result).toEqual({ country: 'US', numbers: [] });
    expect(twilio.search).toHaveBeenCalledWith(
      expect.objectContaining({ isoCountry: 'US', type: 'local', limit: 20 }),
    );
    expect(exotel.search).not.toHaveBeenCalled();
  });

  it('routes IN to Exotel', async () => {
    const { service, exotel } = setup();
    exotel.search.mockResolvedValue([]);
    await service.searchAvailable({ country: 'IN', region: 'KA' });
    expect(exotel.search).toHaveBeenCalledWith(
      expect.objectContaining({ isoCountry: 'IN', type: 'mobile' }),
    );
  });

  it('rejects types and filters the country does not support', async () => {
    const { service } = setup();
    await expect(
      service.searchAvailable({ country: 'US', type: 'mobile' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.searchAvailable({ country: 'US', region: 'KA' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.searchAvailable({ country: 'IN', areaCode: '415' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PhoneNumbersService.purchase', () => {
  it('reserves, buys, then records the provider sid', async () => {
    const { service, repo, twilio } = setup();
    await service.purchase(purchaseDto, admin);

    expect(repo.createProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'c1',
        country_code: '+1',
        phone_number: '4155550199',
        e164: '+14155550199',
        provider: 'twilio',
        purchased_by: 'u1',
        envType: 'production',
      }),
    );
    expect(twilio.purchase).toHaveBeenCalledWith('+14155550199', {
      friendlyName: 'Sales line',
    });
    expect(repo.markPurchased).toHaveBeenCalledWith(
      'pn-doc',
      expect.objectContaining({ provider_sid: 'PN123' }),
    );
  });

  it('does not call the provider when the number is already reserved', async () => {
    const { service, repo, twilio } = setup();
    repo.createProvisioning.mockRejectedValue({ code: 11000 });
    await expect(service.purchase(purchaseDto, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(twilio.purchase).not.toHaveBeenCalled();
  });

  it('drops the reservation when the provider purchase fails', async () => {
    const { service, repo, twilio } = setup();
    twilio.purchase.mockRejectedValue(new ConflictException('gone'));
    await expect(service.purchase(purchaseDto, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.deleteById).toHaveBeenCalledWith('pn-doc');
  });

  it('drops the reservation on an explicit rejection or missing credentials', async () => {
    for (const error of [
      new PurchaseRejectedException('no'),
      new ServiceUnavailableException('Not Configured'),
    ]) {
      const { service, repo, twilio } = setup();
      twilio.purchase.mockRejectedValue(error);
      await expect(service.purchase(purchaseDto, admin)).rejects.toBe(error);
      expect(repo.deleteById).toHaveBeenCalledWith('pn-doc');
    }
  });

  it('keeps the reservation when the provider outcome is unknown', async () => {
    for (const error of [
      new BadGatewayException('timeout'),
      new Error('socket hang up'),
    ]) {
      const { service, repo, twilio } = setup();
      twilio.purchase.mockRejectedValue(error);
      await expect(service.purchase(purchaseDto, admin)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(repo.deleteById).not.toHaveBeenCalled();
    }
  });

  it('retries saving a billed purchase', async () => {
    const { service, repo } = setup();
    repo.markPurchased
      .mockRejectedValueOnce(new Error('db blip'))
      .mockRejectedValueOnce(new Error('db blip'));
    await expect(service.purchase(purchaseDto, admin)).resolves.toEqual({
      id: 'pn-doc',
      status: 'Available',
    });
    expect(repo.markPurchased).toHaveBeenCalledTimes(3);
  });

  it('keeps the reservation when the purchase succeeded but saving failed', async () => {
    const { service, repo } = setup();
    repo.markPurchased.mockRejectedValue(new Error('db down'));
    await expect(service.purchase(purchaseDto, admin)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(repo.markPurchased).toHaveBeenCalledTimes(3);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('rejects a number from another country', async () => {
    const { service, repo } = setup();
    await expect(
      service.purchase(
        { ...purchaseDto, phone_number: '+919876543210' },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createProvisioning).not.toHaveBeenCalled();
  });
});

describe('PhoneNumbersService.reconcileProvisioning', () => {
  const createdAt = new Date('2026-10-30T10:00:00Z');
  const row = (id: string, e164: string, provider = 'exotel') => ({
    _id: id,
    e164,
    provider,
    status: 'Provisioning',
    created_at: createdAt,
  });
  const ownedExo = {
    provider_sid: 'exo-sid-1',
    e164: '+919876543210',
    friendly_name: '09876543210',
    capabilities: { voice: true, sms: true, mms: false },
    inbound_configured: true,
  };

  it('recovers owned numbers and drops the ones never bought', async () => {
    const { service, repo, exotel } = setup();
    repo.findStaleProvisioning.mockResolvedValue([
      row('r1', '+919876543210'),
      row('r2', '+919000000000'),
    ]);
    exotel.listOwned.mockResolvedValue([ownedExo]);

    const result = await service.reconcileProvisioning('c1');

    expect(result).toEqual({
      recovered: ['+919876543210'],
      removed: ['+919000000000'],
      unresolved: [],
    });
    expect(repo.findStaleProvisioning).toHaveBeenCalledWith(
      'c1',
      expect.any(Date),
    );
    expect(repo.markPurchased).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        provider_sid: 'exo-sid-1',
        inbound_configured: true,
      }),
      createdAt,
    );
    expect(repo.deleteProvisioning).toHaveBeenCalledWith('r2');
  });

  it('deletes nothing when the provider list is unavailable', async () => {
    const { service, repo, exotel } = setup();
    repo.findStaleProvisioning.mockResolvedValue([row('r1', '+919876543210')]);
    exotel.listOwned.mockRejectedValue(new BadGatewayException('down'));

    const result = await service.reconcileProvisioning('c1');

    expect(result.unresolved).toEqual(['+919876543210']);
    expect(repo.deleteProvisioning).not.toHaveBeenCalled();
    expect(repo.markPurchased).not.toHaveBeenCalled();
  });

  it('lists each provider once', async () => {
    const { service, repo, exotel, twilio } = setup();
    repo.findStaleProvisioning.mockResolvedValue([
      row('r1', '+919876543210'),
      row('r2', '+919000000000'),
      row('r3', '+14155550199', 'twilio'),
    ]);
    await service.reconcileProvisioning('c1');
    expect(exotel.listOwned).toHaveBeenCalledTimes(1);
    expect(twilio.listOwned).toHaveBeenCalledTimes(1);
  });
});

describe('PhoneNumbersService.release', () => {
  const owned = {
    companyId: 'c1',
    provider: 'twilio',
    provider_sid: 'PN123',
    status: 'Available',
    assigned_agent: null,
  };

  it('releases at the provider and marks the row Released', async () => {
    const { service, repo, twilio } = setup();
    repo.filterById.mockResolvedValue(owned);
    await service.release('pn-doc', 'c1');
    expect(twilio.release).toHaveBeenCalledWith('PN123');
    expect(repo.markReleased).toHaveBeenCalledWith('pn-doc');
  });

  it('refuses while an agent is assigned', async () => {
    const { service, repo, twilio } = setup();
    repo.filterById.mockResolvedValue({ ...owned, assigned_agent: 'a1' });
    await expect(service.release('pn-doc', 'c1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(twilio.release).not.toHaveBeenCalled();
  });

  it('retires legacy manual numbers without calling a provider', async () => {
    const { service, repo, twilio } = setup();
    repo.filterById.mockResolvedValue({
      ...owned,
      provider: null,
      provider_sid: null,
    });
    await service.release('pn-doc', 'c1');
    expect(twilio.release).not.toHaveBeenCalled();
    expect(repo.markReleased).toHaveBeenCalled();
  });
});

describe('PhoneNumbersService.assignAgent', () => {
  it('unassigns with null, even on a released number', async () => {
    const { service, repo } = setup();
    repo.filterById.mockResolvedValue({
      companyId: 'c1',
      status: 'Released',
      assigned_agent: 'a1',
    });
    await service.assignAgent('pn-doc', null, 'c1');
    expect(repo.updateAssignedAgent).toHaveBeenCalledWith('pn-doc', null);
  });

  it('assigns a free staging number', async () => {
    const { service, repo } = setup();
    repo.filterById.mockResolvedValue({
      companyId: 'c1',
      status: 'Available',
      envType: 'staging',
      assigned_agent: null,
    });
    await service.assignAgent('pn-doc', 'a1', 'c1');
    expect(repo.updateAssignedAgent).toHaveBeenCalledWith('pn-doc', 'a1');
  });

  it('refuses a production number as a stage number', async () => {
    const { service, repo } = setup();
    repo.filterById.mockResolvedValue({
      companyId: 'c1',
      status: 'Available',
      envType: 'production',
      assigned_agent: null,
    });
    await expect(
      service.assignAgent('pn-doc', 'a1', 'c1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateAssignedAgent).not.toHaveBeenCalled();
  });

  it("refuses a staging number that is another agent's", async () => {
    const { service, repo } = setup();
    repo.filterById.mockResolvedValue({
      companyId: 'c1',
      status: 'Available',
      envType: 'staging',
      assigned_agent: 'a2',
    });
    await expect(
      service.assignAgent('pn-doc', 'a1', 'c1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('unassigns a production number with null', async () => {
    const { service, repo } = setup();
    repo.filterById.mockResolvedValue({
      companyId: 'c1',
      status: 'Available',
      envType: 'production',
      assigned_agent: 'a1',
    });
    await service.assignAgent('pn-doc', null, 'c1');
    expect(repo.updateAssignedAgent).toHaveBeenCalledWith('pn-doc', null);
  });

  it('refuses to assign a released number', async () => {
    const { service, repo } = setup();
    repo.filterById.mockResolvedValue({ companyId: 'c1', status: 'Released' });
    await expect(
      service.assignAgent('pn-doc', 'a1', 'c1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateAssignedAgent).not.toHaveBeenCalled();
  });
});

describe('toE164', () => {
  it('normalizes provider formats', () => {
    expect(toE164('+91 98765 43210', '+91')).toBe('+919876543210');
    expect(toE164('08047112233', '+91')).toBe('+918047112233');
    expect(toE164('918047112233', '+91')).toBe('+918047112233');
    expect(toE164('4155550199', '+1')).toBe('+14155550199');
  });
});

describe('PhoneNumber JSON', () => {
  it('never serializes provider fields', () => {
    const PhoneNumberModel = model('PhoneNumberJsonSpec', PhoneNumberSchema);
    const json = new PhoneNumberModel({
      country_code: '+1',
      phone_number: '4155550199',
      label: 'Sales',
      provider: 'twilio',
      provider_sid: 'PN123',
    }).toJSON() as Record<string, unknown>;
    expect(json).not.toHaveProperty('provider');
    expect(json).not.toHaveProperty('provider_sid');
    expect(json.phone_number).toBe('4155550199');
  });
});
