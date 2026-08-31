export class QuizCrudController {
    quizRepo;
    constructor(quizRepo) {
        this.quizRepo = quizRepo;
    }
    async listQuizzes(userId) {
        return await this.quizRepo.listQuizzes(userId);
    }
    async listSubjects(userId) {
        return await this.quizRepo.listSubjects(userId);
    }
    async createSubject(name, color, userId) {
        return await this.quizRepo.createSubject(name, color, userId);
    }
    async getQuiz(id, userId) {
        const quiz = await this.quizRepo.getQuizById(id, userId);
        if (!quiz)
            return null;
        const questions = await this.quizRepo.getQuestionsByQuizId(id);
        return { ...quiz, questions };
    }
    async createQuiz(dto, userId) {
        return await this.quizRepo.createQuiz(dto, userId);
    }
    async updateQuiz(id, dto, userId) {
        return await this.quizRepo.updateQuiz(id, dto, userId);
    }
    async deleteQuiz(id, userId) {
        return await this.quizRepo.deleteQuiz(id, userId);
    }
    async addQuestion(quizId, dto) {
        return await this.quizRepo.addQuestion(quizId, dto);
    }
    async updateQuestion(questionId, dto) {
        return await this.quizRepo.updateQuestion(questionId, dto);
    }
    async deleteQuestion(questionId) {
        return await this.quizRepo.deleteQuestion(questionId);
    }
    async reorderQuestions(quizId, questionIds) {
        return await this.quizRepo.reorderQuestions(quizId, questionIds);
    }
}
