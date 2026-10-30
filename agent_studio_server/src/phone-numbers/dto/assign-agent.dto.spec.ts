import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AssignAgentDto } from './assign-agent.dto';

const errorsFor = (body: object) =>
  validateSync(plainToInstance(AssignAgentDto, body));

describe('AssignAgentDto', () => {
  it('accepts an agent id', () => {
    expect(errorsFor({ assigned_agent: 'agent-1' })).toHaveLength(0);
  });

  it('accepts null to unassign', () => {
    expect(errorsFor({ assigned_agent: null })).toHaveLength(0);
  });

  it('rejects an empty string or a missing field', () => {
    expect(errorsFor({ assigned_agent: '' })).not.toHaveLength(0);
    expect(errorsFor({})).not.toHaveLength(0);
  });
});
