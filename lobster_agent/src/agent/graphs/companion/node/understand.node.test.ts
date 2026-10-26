import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { chooseRoute, recentTurns, REPLY_NODES, toSignals } from './understand.node.js';
import { companionGraph } from '../graph/companion.graph.js';

// Run with: npm test

describe('chooseRoute', () => {
  it('always goes to Care_Check_Node on distress, whatever the LLM routed', () => {
    for (const route of REPLY_NODES) {
      assert.equal(chooseRoute({ route, distress: true }), 'Care_Check_Node');
    }
  });

  it('keeps the LLM route otherwise', () => {
    assert.equal(chooseRoute({ route: 'Plan_Node', distress: false }), 'Plan_Node');
  });
});

describe('toSignals', () => {
  it('treats any named girl as a mention', () => {
    const signals = toSignals({
      route: 'Banter_Node',
      userEmotion: 'happy',
      flirtedOrComplimented: false,
      otherGirlName: 'Priya',
      dismissiveOrRude: false,
      apologized: false,
      sharedSomething: true,
      distress: false,
    });
    assert.equal(signals.otherGirlMentioned, true);
  });
});

describe('recentTurns', () => {
  it('trims forward so the window starts on a user turn', () => {
    const messages = [new HumanMessage('a'), new AIMessage('b'), new HumanMessage('c'), new AIMessage('d')];
    const recent = recentTurns(messages, 3);
    assert.deepEqual(recent.map((m) => m.content), ['c', 'd']);
  });
});

describe('companionGraph', () => {
  it('registers every node the router can pick', () => {
    const nodes = Object.keys(companionGraph.nodes);
    for (const node of [...REPLY_NODES, 'Greeting_Node']) {
      assert.ok(nodes.includes(node), `${node} is routable but not in the graph`);
    }
  });
});
