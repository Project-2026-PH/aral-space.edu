import { Quiz, QuizQuestion, CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, Subject, UpdateShareConfigDto, PublicQuizDto, UpdateSubjectShareConfigDto, SubjectShareConfig, PublicSubjectDto, SubjectAccess, SubjectCollaboratorLink, UpdateSubjectDto, LibraryData } from '@quiz-creator/types';

export interface IQuizRepository {
  listSubjects(userId?: string): Promise<Subject[]>;
  createSubject(name: string, color: string, userId?: string): Promise<Subject>;
  recordSubjectView?(subjectId: string, viewerId: string): Promise<void>;
  getSubjectViewerCount?(subjectId: string, ownerId: string): Promise<number>;
  updateSubject(subjectId: string, dto: UpdateSubjectDto, userId?: string): Promise<Subject>;
  deleteSubject(subjectId: string, userId?: string): Promise<boolean>;
  archiveSubject(subjectId: string, userId?: string): Promise<boolean>;
  restoreSubject(subjectId: string, userId?: string): Promise<boolean>;
  listArchivedSubjects(userId: string): Promise<Subject[]>;
  getSubjectAccess(subjectId: string, userId?: string): Promise<SubjectAccess | null>;
  listQuizzesBySubject(subjectId: string, userId?: string): Promise<Quiz[]>;
  createSubjectCollaboratorLink(subjectId: string, expiresAt: string | null, userId: string, maxUses?: number): Promise<SubjectCollaboratorLink>;
  redeemSubjectCollaboratorLink(token: string, userId: string): Promise<SubjectAccess | null>;
  getSubjectShareConfig(subjectId: string, userId?: string): Promise<SubjectShareConfig>;
  updateSubjectShareConfig(subjectId: string, dto: UpdateSubjectShareConfigDto, userId?: string): Promise<SubjectShareConfig>;
  getSubjectByShareToken(shareToken: string): Promise<PublicSubjectDto | null>;
  listQuizzes(userId?: string): Promise<Quiz[]>;
  listQuizzesAndSubjects?(userId?: string): Promise<LibraryData>;
  getQuizById(id: string, userId?: string): Promise<Quiz | null>;
  createQuiz(dto: CreateQuizDto, userId?: string): Promise<Quiz>;
  updateQuiz(id: string, dto: UpdateQuizDto, userId?: string): Promise<Quiz>;
  deleteQuiz(id: string, userId?: string): Promise<boolean>;
  archiveQuiz(id: string, userId?: string): Promise<boolean>;
  restoreQuiz(id: string, userId?: string): Promise<boolean>;
  listArchivedQuizzes(userId: string): Promise<Quiz[]>;
  purgeUserData?(userId: string): Promise<void>;

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
