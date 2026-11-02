import { CacheService } from '../common/services/cache.service';
import { PendingCallsStore } from './pending-calls.store';
import { CallContext } from './telephony.types';

const context: CallContext = {
  provider: 'exotel',
  direction: 'outbound',
  business: 'real_estate_sales',
  voice: 'Aoede',
  systemInstruction: '',
  customerNumber: '+919876543210',
  businessNumber: '+918047491899',
};

describe('PendingCallsStore', () => {
  let store: PendingCallsStore;

  beforeEach(() => {
    store = new PendingCallsStore(new CacheService());
  });

  it('hands a call over by sid exactly once', () => {
    store.save('sid-1', context);
    expect(store.take('exotel', 'sid-1', [])).toEqual(context);
    expect(store.take('exotel', 'sid-1', [])).toBeUndefined();
    // The number key went with it.
    expect(store.take('exotel', undefined, ['+919876543210'])).toBeUndefined();
  });

  it('falls back to the customer number when the sid differs', () => {
    store.save('sid-1', context);
    expect(
      store.take('exotel', 'other-sid', ['+918047491899', '+919876543210']),
    ).toEqual(context);
    expect(store.take('exotel', 'sid-1', [])).toBeUndefined();
  });

  it('keeps carriers apart', () => {
    store.save('sid-1', context);
    expect(store.take('twilio', 'sid-1', ['+919876543210'])).toBeUndefined();
  });

  it('discards calls that never connected', () => {
    store.save('sid-1', context);
    store.discard('exotel', 'sid-1');
    expect(store.take('exotel', 'sid-1', ['+919876543210'])).toBeUndefined();
  });
});
