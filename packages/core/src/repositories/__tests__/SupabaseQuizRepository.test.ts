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
  it('creates the quiz and questions through the atomic Supabase RPC', async () => {
    const fallback = fallbackRepository();
    (fallback as any).createQuiz = vi.fn();
    const createdQuiz = { id: 'quiz-1', title: 'Atomic Quiz', question_count: 1 };
    const rpc = vi.fn().mockResolvedValue({ data: [createdQuiz], error: null });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      rpc,
    } as any;

    const repository = new SupabaseQuizRepository(supabase, fallback);
    const dto = {
      title: 'Atomic Quiz',
      questions: [{ question_text: 'What?', options: ['This'], correct_answer: 0 }],
    };

    await expect(repository.createQuiz(dto)).resolves.toEqual(createdQuiz);
    expect(rpc).toHaveBeenCalledWith('create_quiz_with_questions', expect.objectContaining({
      p_title: 'Atomic Quiz',
      p_question_count: 1,
      p_questions: [expect.objectContaining({ question_text: 'What?', order_index: 0 })],
    }));
    expect(supabase.from).not.toHaveBeenCalledWith('quiz_questions');
    expect((fallback as any).createQuiz).not.toHaveBeenCalled();
  });

  it('does not fall back after an atomic creation failure', async () => {
    const fallback = fallbackRepository();
    (fallback as any).createQuiz = vi.fn();
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '23514', message: 'question write failed' } }),
    } as any;

    const repository = new SupabaseQuizRepository(supabase, fallback);
    await expect(repository.createQuiz({ title: 'Broken Quiz', questions: [] })).rejects.toMatchObject({ code: '23514' });
    expect((fallback as any).createQuiz).not.toHaveBeenCalled();
  });

  it('reports when the atomic creation function has not been installed', async () => {
    const fallback = fallbackRepository();
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function create_quiz_with_questions' } }),
    } as any;

    const repository = new SupabaseQuizRepository(supabase, fallback);
    await expect(repository.createQuiz({ title: 'Unmigrated Quiz', questions: [] })).rejects.toThrow(
      'Apply sql/migrations/20261106_atomic_quiz_creation.sql'
    );
  });

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
