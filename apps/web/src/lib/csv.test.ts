import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', null]])).toBe(
      'a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",\r\n',
    );
  });

  it('neutralises spreadsheet formulas', () => {
    expect(toCsv(['a'], [['=SUM(A1)']])).toBe("a\r\n'=SUM(A1)\r\n");
  });

  it('formats dates as ISO', () => {
    expect(toCsv(['d'], [[new Date('2026-01-02T03:04:05Z')]])).toBe('d\r\n2026-01-02T03:04:05.000Z\r\n');
  });
});
