import { describe, expect, it, vi } from 'vitest';
import { StreamingMessageParser, type ActionCallback, type ArtifactCallback, type ParserCallbacks } from './message-parser';
import { AgentOutputParser } from '../agents/agent-output-parser';

interface ExpectedResult {
  output: string;
  callbacks?: {
    onArtifactOpen?: number;
    onArtifactClose?: number;
    onActionOpen?: number;
    onActionClose?: number;
  };
}

describe('StreamingMessageParser', () => {
  it('should pass through normal text', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello, world!')).toBe('Hello, world!');
  });

  it('should allow normal HTML tags', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello <strong>world</strong>!')).toBe('Hello <strong>world</strong>!');
  });

  describe('no artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar', 'Foo bar'],
      ['Foo bar <', 'Foo bar '],
      ['Foo bar <p', 'Foo bar <p'],
      [['Foo bar <', 's', 'p', 'an>some text</span>'], 'Foo bar <span>some text</span>'],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('invalid or incomplete artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar <b', 'Foo bar '],
      ['Foo bar <ba', 'Foo bar <ba'],
      ['Foo bar <bol', 'Foo bar '],
      ['Foo bar <bolt', 'Foo bar '],
      ['Foo bar <bolta', 'Foo bar <bolta'],
      ['Foo bar <boltA', 'Foo bar '],
      ['Foo bar <boltArtifacs></boltArtifact>', 'Foo bar <boltArtifacs></boltArtifact>'],
      ['Before <oltArtfiact>foo</boltArtifact> After', 'Before <oltArtfiact>foo</boltArtifact> After'],
      ['Before <boltArtifactt>foo</boltArtifact> After', 'Before <boltArtifactt>foo</boltArtifact> After'],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts without actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Some text before <boltArtifact title="Some title" id="artifact_1">foo bar</boltArtifact> Some more text',
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        ['Some text before <boltArti', 'fact', ' title="Some title" id="artifact_1">foo</boltArtifact> Some more text'],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fac',
          't title="Some title" id="artifact_1"',
          ' ',
          '>',
          'foo</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact',
          ' title="Some title" id="artifact_1"',
          ' >fo',
          'o</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact tit',
          'le="Some ',
          'title" id="artifact_1">fo',
          'o',
          '<',
          '/boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact title="Some title" id="artif',
          'act_1">fo',
          'o<',
          '/boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        'Before <boltArtifact title="Some title" id="artifact_1">foo</boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts with actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction></boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 1, onActionClose: 1 },
        },
      ],
      [
        'Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction><boltAction type="file" filePath="index.js">some content</boltAction></boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 2, onActionClose: 2 },
        },
      ],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });
});

describe('StreamingMessageParser - ToolCall Parsing', () => {
  describe('toolCall parsing', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        '<toolCall name="routeToAgent" agentId="coordinator">\n<parameter name="agentId">project-scaffold</parameter>\n<parameter name="query">Build a todo app</parameter>\n<parameter name="confidence">0.9</parameter>\n</toolCall>',
        {
          output: '',
          callbacks: { onArtifactOpen: 0, onArtifactClose: 0, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      // Test chunked streaming of toolCall
      [
        [
          '<toolCall name="routeToAgent" ',
          'agentId="coordinator">\n',
          '<parameter name="agentId">project-scaffold</parameter>\n',
          '<parameter name="query">Build a todo app</parameter>\n',
          '<parameter name="confidence">0.9</parameter>\n',
          '</toolCall>'
        ],
        {
          output: '',
          callbacks: { onArtifactOpen: 0, onArtifactClose: 0, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      // Test toolCall within artifact
      [
        'Before <boltArtifact title="Some title" id="artifact_1"><toolCall name="routeToAgent" agentId="coordinator">\n<parameter name="agentId">project-scaffold</parameter>\n</toolCall></boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      // Test incomplete toolCall
      [
        '<toolCall name="routeToAgent" agentId="coordinator">\n<parameter name="agentId">project-scaffold</parameter>',
        {
          output: '',
          callbacks: { onArtifactOpen: 0, onArtifactClose: 0, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      // Test malformed toolCall
      [
        '<toolCall name="routeToAgent"><parameter name="invalid">value</parameter></toolCall>',
        {
          output: '',
          callbacks: { onArtifactOpen: 0, onArtifactClose: 0, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      // Test toolCall with text before and after
      [
        'Some text before <toolCall name="routeToAgent" agentId="coordinator">\n<parameter name="agentId">project-scaffold</parameter>\n</toolCall> Some text after',
        {
          output: 'Some text before ',
          callbacks: { onArtifactOpen: 0, onArtifactClose: 0, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      // Test nested toolCalls (should treat as invalid)
      [
        '<toolCall name="outer"><toolCall name="inner"></toolCall></toolCall>',
        {
          output: '',
          callbacks: { onArtifactOpen: 0, onArtifactClose: 0, onActionOpen: 0, onActionClose: 0 },
        },
      ],
    ])('should correctly parse toolCall chunks (%#)', (input, outputOrExpectedResult) => {
      let expected: ExpectedResult;
      if (typeof outputOrExpectedResult === 'string') {
        expected = { output: outputOrExpectedResult };
      } else {
        expected = outputOrExpectedResult;
      }
      const mockAgentOutputParser = {
        getToolCallTagOpen: () => '<toolCall',
        parse: vi.fn().mockImplementation((messageId, input) => {
          if (input.includes('</toolCall>')) {
            return {
              cursor: { position: input.indexOf('</toolCall>') + '</toolCall>'.length },
              event: { type: 'toolCallComplete' }
            };
          }
          return { cursor: { position: 0 }, event: null };
        })
      };

      const parser = new StreamingMessageParser({
        artifactElement: () => '',
        callbacks: {
          onArtifactOpen: vi.fn(),
          onArtifactClose: vi.fn(),
          onActionOpen: vi.fn(),
          onActionClose: vi.fn(),
        },
        agentOutputParser: mockAgentOutputParser as unknown as AgentOutputParser
      });

      let message = '';
      let result = '';
      const chunks = Array.isArray(input) ? input : [input];

      for (const chunk of chunks) {
        message += chunk;
        result += parser.parse('message_1', message);
      }

      expect(result).toEqual(expected.output);

      // Verify callbacks were called correct number of times
      if (expected.callbacks) {
        for (const [name, count] of Object.entries(expected.callbacks)) {
          type CallbackName = keyof ParserCallbacks;
          if (name === 'onArtifactOpen' || name === 'onArtifactClose' ||
            name === 'onActionOpen' || name === 'onActionStream' || name === 'onActionClose') {
            const callbacks=parser['_options'].callbacks
            const callback = callbacks?.[name as CallbackName];
            if (callback && typeof callback === 'function') {
              expect(callback).toHaveBeenCalledTimes(count);
            }
          }
        }
      }
    });
  });
});

function runTest(input: string | string[], outputOrExpectedResult: string | ExpectedResult) {
  let expected: ExpectedResult;

  if (typeof outputOrExpectedResult === 'string') {
    expected = { output: outputOrExpectedResult };
  } else {
    expected = outputOrExpectedResult;
  }

  const callbacks = {
    onArtifactOpen: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactOpen');
    }),
    onArtifactClose: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactClose');
    }),
    onActionOpen: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionOpen');
    }),
    onActionClose: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionClose');
    }),
  };

  const parser = new StreamingMessageParser({
    artifactElement: () => '',
    callbacks,
    agentOutputParser: new AgentOutputParser()
  });

  let message = '';

  let result = '';

  const chunks = Array.isArray(input) ? input : input.split('');

  for (const chunk of chunks) {
    message += chunk;

    result += parser.parse('message_1', message);
  }

  for (const name in expected.callbacks) {
    const callbackName = name;

    expect(callbacks[callbackName as keyof typeof callbacks]).toHaveBeenCalledTimes(
      expected.callbacks[callbackName as keyof typeof expected.callbacks] ?? 0,
    );
  }

  expect(result).toEqual(expected.output);
}
