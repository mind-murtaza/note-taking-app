import { describe, it, expect } from 'vitest';
import { SHARED_PACKAGE } from '@app/shared';

describe('frontend scaffold', () => {
  it('resolves imports from @app/shared', () => {
    expect(SHARED_PACKAGE).toBe('@app/shared');
  });
});
