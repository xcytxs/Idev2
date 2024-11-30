import { describe, it, expect } from 'vitest';
import { stripIndents } from './stripIndent';

describe('stripIndents', () => {
  it('should strip indents from a regular string', () => {
    const input = `
      Hello
        World
          !
    `;
    const expected = 'Hello\nWorld\n!';
    expect(stripIndents(input)).toBe(expected);
  });

  it('should handle template literals with expressions', () => {
    const name = 'World';
    const result = stripIndents`
      Hello
        ${name}
          !
    `;
    expect(result).toBe('Hello\nWorld\n!');
  });

  it('should handle empty lines', () => {
    const input = `
      First line
      
      Last line
    `;
    expect(stripIndents(input)).toBe('First line\n\nLast line');
  });

  it('should handle strings with no indentation', () => {
    const input = 'Hello\nWorld\n!';
    expect(stripIndents(input)).toBe('Hello\nWorld\n!');
  });

  it('should handle mixed indentation', () => {
    const input = `
      First
    Second
        Third
    `;
    expect(stripIndents(input)).toBe('First\nSecond\nThird');
  });
}); 