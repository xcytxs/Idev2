import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StreamingMessageParser, type ActionCallback, type ArtifactCallback } from './message-parser';

// Define the expected result structure for our tests
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
  let parser: StreamingMessageParser;

  // Initialize a new parser before each test
  beforeEach(() => {
    parser = new StreamingMessageParser();
  });

  it('should pass through normal text', () => {
    expect(parser.parse('test_id', 'Hello, world!')).toBe('Hello, world!');
  });

  it('should allow normal HTML tags', () => {
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

// Helper function to run tests with various inputs and expected results
function runTest(input: string | string[], outputOrExpectedResult: string | ExpectedResult) {
  // Normalize the expected result
  const expected: ExpectedResult = typeof outputOrExpectedResult === 'string' 
    ? { output: outputOrExpectedResult } 
    : outputOrExpectedResult;

  // Mock callback functions
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

  // Create a new parser instance with mocked callbacks
  const parser = new StreamingMessageParser({
    artifactElement: () => '',
    callbacks,
  });

  // Parse the input chunks and accumulate the result
  const chunks = Array.isArray(input) ? input : input.split('');
  const result = chunks.reduce((acc, chunk) => acc + parser.parse('message_1', chunk), '');

  // Verify that callbacks were called the expected number of times
  Object.entries(expected.callbacks || {}).forEach(([name, count]) => {
    expect(callbacks[name as keyof typeof callbacks]).toHaveBeenCalledTimes(count || 0);
  });

  // Check if the final output matches the expected output
  expect(result).toEqual(expected.output);
}
