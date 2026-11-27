import {
  genericServiceContent,
  normalizeServiceContent,
  serviceContentBySlug,
} from '@/config/service-content';

describe('normalizeServiceContent', () => {
  it('fills arrays the API does not send for a service with no bundled copy', () => {
    // `GET /services/{slug}` currently sends only these fields.
    const content = normalizeServiceContent('admin-added-service', {
      slug: 'admin-added-service',
      intro: 'Deep clean for move-outs.',
      cardImage: 'services/move-out.jpg',
      heroImage: 'services/move-out.jpg',
    });

    expect(content.intro).toBe('Deep clean for move-outs.');
    expect(content.includes.length).toBeGreaterThan(0);
    expect(content.excludes.length).toBeGreaterThan(0);
    expect(content.faqs.length).toBeGreaterThan(0);
    expect(content.rating).toBe(0);
    expect(content.reviewCount).toBe(0);
  });

  it('merges over bundled copy without losing fields the payload omits', () => {
    const local = serviceContentBySlug('home-clean');
    expect(local).toBeDefined();

    const content = normalizeServiceContent('home-clean', { intro: 'Server intro.' }, local);

    expect(content.intro).toBe('Server intro.');
    expect(content.includes).toEqual(local!.includes);
    expect(content.faqs).toEqual(local!.faqs);
    expect(content.slug).toBe('home-clean');
  });

  it('rejects malformed values instead of trusting the payload', () => {
    const content = normalizeServiceContent('broken', {
      includes: 'not-a-list' as unknown as string[],
      excludes: [null as unknown as string, '  ', 'Real exclusion'],
      faqs: [null, { question: '', answer: 'orphan' }, { question: 'Q?', answer: 'A.' }] as never,
      rating: Number.NaN,
    });

    expect(content.includes).toEqual(genericServiceContent('broken').includes);
    expect(content.excludes).toEqual(['Real exclusion']);
    expect(content.faqs).toEqual([{ question: 'Q?', answer: 'A.' }]);
    expect(content.rating).toBe(0);
  });
});
