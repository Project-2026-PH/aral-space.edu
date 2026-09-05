import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto, UpdateSubjectShareConfigDto, SubjectShareConfig, PublicSubjectDto } from '@quiz-creator/types';

export interface IQuizRepository {
  listSubjects(userId?: string): Promise<Subject[]>;
  createSubject(name: string, color: string, userId?: string): Promise<Subject>;
  deleteSubject(subjectId: string, userId?: string): Promise<boolean>;
  getSubjectShareConfig(subjectId: string, userId?: string): Promise<SubjectShareConfig>;
  updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string): Promise<SubjectShareConfig>;
  getSubjectByShareToken(shareToken: string): Promise<PublicSubjectDto | null>;
  listQuizzes(userId?: string): Promise<Quiz[]>;
  listQuizzesAndSubjects?(userId?: string): Promise<{ quizzes: Quiz[]; subjects: Subject[] }>;
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
