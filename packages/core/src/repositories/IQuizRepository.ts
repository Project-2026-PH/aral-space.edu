import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto, UpdateSubjectShareConfigDto, SubjectShareConfig, PublicSubjectDto, SubjectAccess, SubjectCollaboratorLink, UpdateSubjectDto } from '@quiz-creator/types';

export interface IQuizRepository {
  listSubjects(userId?: string): Promise<Subject[]>;
  createSubject(name: string, color: string, userId?: string): Promise<Subject>;
  updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string): Promise<Subject>;
  deleteSubject(subjectId: string, userId?: string): Promise<boolean>;
  getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null>;
  listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]>;
  createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string): Promise<SubjectCollaboratorLink>;
  redeemSubjectCollaboratorLink(token: string, userId: string): Promise<SubjectAccess | null>;
  getSubjectShareConfig(subjectId: string, userId?: string): Promise<SubjectShareConfig>;
  updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string): Promise<SubjectShareConfig>;
  getSubjectByShareToken(shareToken: string): Promise<PublicSubjectDto | null>;
  listQuizzes(userId?: string): Promise<Quiz[]>;
  listQuizzesAndSubjects?(userId?: string): Promise<{ quizzes: Quiz[]; subjects: Subject[] }>;
  getQuizById(id: string, userId?: string): Promise<Quiz | null>;
  createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz>;
  updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz>;
  deleteQuiz(id: string, userId?: string): Promise<boolean>;

  /** When userId is supplied, the repository must enforce quiz access. */
  getQuestionsByQuizId(quizId: string, userId?: string): Promise<QuizQuestion[]>;
  addQuestion(quizId: string, dto: CreateQuestionDto, userId?: string): Promise<QuizQuestion>;
  updateQuestion(quizId: string, questionId: string, dto: UpdateQuestionDto, userId?: string): Promise<QuizQuestion>;
  deleteQuestion(quizId: string, questionId: string, userId?: string): Promise<boolean>;
  reorderQuestions(quizId: string, questionIds: string[], userId?: string): Promise<boolean>;

  getShareConfig(quizId: string, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean; allow_public_answer_key?: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }>;
  updateShareConfig(quizId: string, dto: UpdateShareConfigDto, userId?: string): Promise<{ share_token: string; is_public: boolean; allow_cloning: boolean; allow_public_answer_key?: boolean; share_expires_at?: string | null; share_revoked_at?: string | null }>;
  getQuizByShareToken(shareToken: string): Promise<PublicQuizDto | null>;
  cloneQuizByShareToken(shareToken: string, userId?: string): Promise<Quiz>;
}
