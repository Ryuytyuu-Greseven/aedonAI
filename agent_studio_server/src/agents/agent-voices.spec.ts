import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAgentDto } from './dto/update-agent.dto';

async function voiceErrors(voice: unknown): Promise<string[]> {
  const dto = plainToInstance(UpdateAgentDto, { agent_id: 'a1', voice });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === 'voice').map((e) => e.property);
}

describe('agent voice validation', () => {
  it('accepts every voice code and an omitted voice', async () => {
    for (const voice of [
      'female_1',
      'male_1',
      'female_2',
      'male_2',
      'female_3',
      'male_3',
      undefined,
    ]) {
      expect(await voiceErrors(voice)).toEqual([]);
    }
  });

  it('rejects provider voice names and unknown codes', async () => {
    expect(await voiceErrors('Aoede')).toEqual(['voice']);
    expect(await voiceErrors('male_4')).toEqual(['voice']);
  });
});
