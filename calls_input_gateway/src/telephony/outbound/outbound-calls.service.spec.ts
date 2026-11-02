import { resolveOutboundProvider } from './outbound-calls.service';

describe('resolveOutboundProvider', () => {
  it('routes Indian destinations through Exotel', () => {
    expect(resolveOutboundProvider({ to: '+919876543210' }, true)).toBe(
      'exotel',
    );
  });

  it('routes other destinations through Twilio', () => {
    expect(resolveOutboundProvider({ to: '+14155550101' }, true)).toBe(
      'twilio',
    );
  });

  it('lets the business number decide when given', () => {
    // A US Twilio number calling India must stay on Twilio…
    expect(
      resolveOutboundProvider(
        { to: '+919876543210', from: '+14155550106' },
        true,
      ),
    ).toBe('twilio');
    // …and an ExoPhone always calls through Exotel.
    expect(
      resolveOutboundProvider(
        { to: '+919876543210', from: '+918047491899' },
        true,
      ),
    ).toBe('exotel');
  });

  it('falls back to the destination when from is empty (previews)', () => {
    expect(
      resolveOutboundProvider({ to: '+919876543210', from: '' }, true),
    ).toBe('exotel');
  });

  it('honours an explicit provider', () => {
    expect(
      resolveOutboundProvider(
        { to: '+919876543210', provider: 'twilio' },
        true,
      ),
    ).toBe('twilio');
  });

  it('uses Twilio for everything when Exotel is disabled', () => {
    expect(resolveOutboundProvider({ to: '+919876543210' }, false)).toBe(
      'twilio',
    );
  });
});
