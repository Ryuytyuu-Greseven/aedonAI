import { isBackchannel } from './backchannel';

describe('isBackchannel', () => {
  it.each([
    'okay',
    'Okay.',
    'ok ok',
    'hmm',
    'got it',
    'theek hai',
    'haan ji',
    'अच्छा',
    'సరే',
    'సరే సరే',
    'சரி',
    'ಸರಿ',
  ])('treats %p as an acknowledgement', (text) => {
    expect(isBackchannel(text)).toBe(true);
  });

  it.each([
    '',
    undefined,
    'yes',
    'no',
    'okay so what about the price',
    'what about the price',
    'okay okay okay',
    'is it ready',
  ])('does not treat %p as an acknowledgement', (text) => {
    expect(isBackchannel(text)).toBe(false);
  });
});
