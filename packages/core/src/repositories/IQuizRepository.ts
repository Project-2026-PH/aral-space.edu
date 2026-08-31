import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto } from '@quiz-creator/types';

export interface IQuizRepository {
  listSubjects(userId?: string): Promise<Subject[]>;
  createSubject(name: string, color: string, userId?: string): Promise<Subject>;
  listQuizzes(userId?: string): Promise<Quiz[]>;
  getQuizById(id: string, userId?: string): Promise<Quiz | null>;
  createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz>;
  updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz>;
  deleteQuiz(id: string, userId?: string): Promise<boolean>;
  
  getQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]>;
  addQuestion(quizId: string, dto: CreateQuestionDto): Promise<QuizQuestion>;
  updateQuestion(questionId: string, dto: UpdateQuestionDto): Promise<QuizQuestion>;
  deleteQuestion(questionId: string): Promise<boolean>;
  reorderQuestions(quizId: string, questionIds: string[]): Promise<boolean>;

  getShareConfig(quizId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }>;
  updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean }>;
  getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null>;
  cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz>;
}
