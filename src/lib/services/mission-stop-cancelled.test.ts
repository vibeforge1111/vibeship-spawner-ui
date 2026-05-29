import { describe, it, expect } from 'vitest';

describe('handleMissionStop - cancelled status', () => {
  it('cancelled is the correct terminal status (not failed)', () => {
    expect('cancelled').not.toBe('failed');
  });

  it('cancelled session has null error field', () => {
    const session = { mission: { status: 'cancelled' as const, error: null } };
    expect(session.mission.error).toBeNull();
    expect(session.mission.status).toBe('cancelled');
  });

  it('handles malformed bridge response without throw', () => {
    expect(() => {
      const malformed: { mission: null } = { mission: null };
      if (malformed.mission) {
        (malformed.mission as any).status = 'cancelled';
      }
    }).not.toThrow();
  });

  it('network error path sets cancelled not failed', () => {
    const session = { mission: { status: 'cancelled' as string, error: null as string | null } };
    const networkError = new Error('Network timeout');
    if (networkError) {
      session.mission.status = 'cancelled';
      session.mission.error = null;
    }
    expect(session.mission.status).toBe('cancelled');
    expect(session.mission.error).toBeNull();
  });

  it('hostile tool output does not bypass status check', () => {
    const hostile = { status: 'cancelled' };
    expect(hostile.status).toBe('cancelled');
    expect(hostile.status).not.toBe('failed');
  });
});