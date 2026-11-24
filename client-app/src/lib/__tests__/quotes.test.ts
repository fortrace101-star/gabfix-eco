import { QUOTE_STATUS_LABELS, QUOTE_STATUS_ORDER } from '@/lib/quotes';

describe('D9 request stages', () => {
  it('labels every stage the customer can see', () => {
    expect(QUOTE_STATUS_LABELS.inspection_needed).toBe('Inspection needed');
    expect(QUOTE_STATUS_LABELS.inspection_scheduled).toBe('Inspection scheduled');
    expect(QUOTE_STATUS_LABELS.inspected).toBe('Inspected');
    expect(QUOTE_STATUS_LABELS.quoted).toBe('Quote ready');
  });

  it('orders the stages before the quote', () => {
    expect(QUOTE_STATUS_ORDER.indexOf('inspection_needed')).toBeLessThan(
      QUOTE_STATUS_ORDER.indexOf('inspection_scheduled'),
    );
    expect(QUOTE_STATUS_ORDER.indexOf('inspected')).toBeLessThan(
      QUOTE_STATUS_ORDER.indexOf('quoted'),
    );
    expect(QUOTE_STATUS_ORDER).not.toContain('declined');
  });
});
