import { describe, expect, it } from 'vitest';
import { formatChange, formatPercent, formatVolume, formatWeight } from './format';

describe('formatVolume', () => {
  it('shows whole pounds with thousands separators', () => {
    expect(formatVolume(12345)).toBe('12,345');
    expect(formatVolume(0)).toBe('0');
    expect(formatVolume(3.75)).toBe('4');
    expect(formatVolume(1234567.4)).toBe('1,234,567');
  });
});

describe('formatChange', () => {
  it('signs changes with + and a true minus', () => {
    expect(formatChange(1250)).toBe('+1,250');
    expect(formatChange(-300)).toBe('−300');
  });

  it('shows no sign for zero, including tiny changes that round to zero', () => {
    expect(formatChange(0)).toBe('0');
    expect(formatChange(0.4)).toBe('0');
    expect(formatChange(-0.4)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('shows whole, signed percentages', () => {
    expect(formatPercent(11.4)).toBe('+11%');
    expect(formatPercent(-5.2)).toBe('−5%');
    expect(formatPercent(150)).toBe('+150%');
    expect(formatPercent(0.3)).toBe('0%');
    expect(formatPercent(-0.3)).toBe('0%');
  });

  it('is blank when there is no percentage', () => {
    expect(formatPercent(null)).toBe('');
  });
});

describe('formatWeight', () => {
  it('shows up to 2 decimals without trailing zeros or grouping', () => {
    expect(formatWeight(225)).toBe('225');
    expect(formatWeight(2.5)).toBe('2.5');
    expect(formatWeight(1.25)).toBe('1.25');
    expect(formatWeight(1500)).toBe('1500');
  });
});
