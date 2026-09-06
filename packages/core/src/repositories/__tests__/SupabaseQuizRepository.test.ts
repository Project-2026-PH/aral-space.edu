import { describe, expect, it, vi } from 'vitest';
import { IQuizRepository } from '../IQuizRepository';
import { SupabaseQuizRepository } from '../SupabaseQuizRepository';

function fallbackRepository(): IQuizRepository & {
  listSubjects: ReturnType<typeof vi.fn>;
  listQuizzes: ReturnType<typeof vi.fn>;
} {
  return {
    listSubjects: vi.fn().mockResolvedValue([{ id: 'fallback-subject', name: 'Fallback', color: '#000000' }]),
    listQuizzes: vi.fn().mockResolvedValue([{ id: 'fallback-quiz', title: 'Fallback', question_count: 0, generated_at: '' }]),
  } as unknown as IQuizRepository & {
    listSubjects: ReturnType<typeof vi.fn>;
    listQuizzes: ReturnType<typeof vi.fn>;
  };
}

describe('SupabaseQuizRepository result semantics', () => {
  it('returns an empty subject list when Supabase succeeds with no rows', async () => {
    const fallback = fallbackRepository();
    const subjectQuery = {
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => subjectQuery),
        })),
      })),
    } as any;

    const repository = new SupabaseQuizRepository(supabase, fallback);

    await expect(repository.listSubjects('user-1')).resolves.toEqual([]);
    expect(fallback.listSubjects).not.toHaveBeenCalled();
  });

  it('returns an empty quiz list when Supabase succeeds with no rows', async () => {
    const fallback = fallbackRepository();
    const quizQuery = {
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => quizQuery),
        })),
      })),
    } as any;

    const repository = new SupabaseQuizRepository(supabase, fallback);

    await expect(repository.listQuizzes('user-1')).resolves.toEqual([]);
    expect(fallback.listQuizzes).not.toHaveBeenCalled();
  });

  it('preserves user scope when an errored quiz list uses the fallback', async () => {
    const fallback = fallbackRepository();
    const quizQuery = {
      eq: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => quizQuery),
        })),
      })),
    } as any;

    const repository = new SupabaseQuizRepository(supabase, fallback);

    await expect(repository.listQuizzes('user-1')).resolves.toEqual([{ id: 'fallback-quiz', title: 'Fallback', question_count: 0, generated_at: '' }]);
    expect(fallback.listQuizzes).toHaveBeenCalledWith('user-1');
  });
});
