export class MemoryQuizRepository {
    subjects = new Map();
    quizzes = new Map();
    questions = new Map();
    constructor() {
        this.seedDefaultData();
    }
    seedDefaultData() {
        const defaultSubject = {
            id: 'sub-default-1',
            name: 'General Knowledge',
            color: '#6366f1',
            created_at: new Date().toISOString()
        };
        this.subjects.set(defaultSubject.id, defaultSubject);
        const defaultQuiz = {
            id: 'quiz-demo-1',
            title: 'Welcome to Quiz Mastery',
            question_count: 5,
            generated_at: new Date().toISOString(),
            handout_name: 'Introduction Handout',
            source_model: 'manual',
            subject_id: defaultSubject.id,
            created_at: new Date().toISOString(),
            subject: defaultSubject
        };
        this.quizzes.set(defaultQuiz.id, defaultQuiz);
        const demoQuestions = [
            {
                question_text: "What is the primary benefit of the Leitner Spaced Repetition method?",
                options: [
                    "Optimizes long-term memory retention by spacing review intervals",
                    "Crams large volumes of information overnight",
                    "Randomizes questions without any interval schedule",
                    "Eliminates the need for practice questions"
                ],
                correct_answer: 0,
                explanation: "Spaced repetition leverages the psychological spacing effect to systematically review material before you forget it.",
                source_pages: [1],
                order_index: 0
            },
            {
                question_text: "In this Quiz Mastery engine, what is the default batch size of active questions?",
                options: ["10 questions", "5 questions", "3 questions", "20 questions"],
                correct_answer: 1,
                explanation: "Batches are grouped into 5 questions to maximize focus without cognitive overload.",
                source_pages: [1],
                order_index: 1
            },
            {
                question_text: "Which architectural pattern organizes code into Model -> Service -> Repository -> Controller?",
                options: ["MVC", "MSRC", "MVVM", "CQRS"],
                correct_answer: 1,
                explanation: "MSRC explicitly separates Domain Data Models, Business Services, Storage Repositories, and Dispatch Controllers.",
                source_pages: [2],
                order_index: 2
            },
            {
                question_text: "What occurs when a question is answered incorrectly during a mastery session?",
                options: [
                    "The question is permanently removed",
                    "The streak resets to 0 and the question repeats in the cycle until mastered",
                    "The session aborts immediately",
                    "The score is halved"
                ],
                correct_answer: 1,
                explanation: "Incorrect answers mark has_missed=true and reset the active streak so you must review it again in the loop.",
                source_pages: [2],
                order_index: 3
            },
            {
                question_text: "Which AI model family powers the automated Handout Quiz generator?",
                options: ["Google Gemini", "GPT-2", "Claude 1", "BERT"],
                correct_answer: 0,
                explanation: "Google Gemini GenAI SDK is used for high-speed streaming question generation from study materials.",
                source_pages: [3],
                order_index: 4
            }
        ];
        demoQuestions.forEach((q, idx) => {
            const id = `q-demo-${idx + 1}`;
            this.questions.set(id, {
                id,
                quiz_id: defaultQuiz.id,
                question_text: q.question_text,
                options: q.options,
                correct_answer: q.correct_answer,
                explanation: q.explanation || null,
                source_pages: q.source_pages || [],
                order_index: idx,
                created_at: new Date().toISOString()
            });
        });
    }
    async listSubjects() {
        return Array.from(this.subjects.values());
    }
    async createSubject(name, color, userId) {
        const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const subject = { id, name, color, user_id: userId, created_at: new Date().toISOString() };
        this.subjects.set(id, subject);
        return subject;
    }
    async listQuizzes() {
        const all = Array.from(this.quizzes.values());
        return all.map(q => ({
            ...q,
            subject: q.subject_id ? this.subjects.get(q.subject_id) || null : null
        }));
    }
    async getQuizById(id) {
        const quiz = this.quizzes.get(id);
        if (!quiz)
            return null;
        return {
            ...quiz,
            subject: quiz.subject_id ? this.subjects.get(quiz.subject_id) || null : null
        };
    }
    async createQuiz(dto, userId) {
        const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const newQuiz = {
            id: quizId,
            title: dto.title,
            question_count: dto.questions.length,
            generated_at: new Date().toISOString(),
            handout_name: dto.handout_name || null,
            source_model: dto.source_model || 'manual',
            subject_id: dto.subject_id || null,
            user_id: userId || null,
            created_at: new Date().toISOString()
        };
        this.quizzes.set(quizId, newQuiz);
        dto.questions.forEach((q, idx) => {
            const qId = `q-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
            this.questions.set(qId, {
                id: qId,
                quiz_id: quizId,
                question_text: q.question_text,
                options: q.options,
                correct_answer: q.correct_answer,
                explanation: q.explanation || null,
                source_pages: q.source_pages || [],
                order_index: idx,
                created_at: new Date().toISOString()
            });
        });
        return newQuiz;
    }
    async updateQuiz(id, dto) {
        const quiz = this.quizzes.get(id);
        if (!quiz)
            throw new Error(`Quiz ${id} not found`);
        if (dto.title !== undefined)
            quiz.title = dto.title;
        if (dto.subject_id !== undefined)
            quiz.subject_id = dto.subject_id;
        this.quizzes.set(id, quiz);
        return quiz;
    }
    async deleteQuiz(id) {
        const deleted = this.quizzes.delete(id);
        for (const [qId, q] of this.questions.entries()) {
            if (q.quiz_id === id)
                this.questions.delete(qId);
        }
        return deleted;
    }
    async getQuestionsByQuizId(quizId) {
        const list = [];
        for (const q of this.questions.values()) {
            if (q.quiz_id === quizId)
                list.push(q);
        }
        return list.sort((a, b) => a.order_index - b.order_index);
    }
    async addQuestion(quizId, dto) {
        const quiz = this.quizzes.get(quizId);
        if (!quiz)
            throw new Error(`Quiz ${quizId} not found`);
        const questions = await this.getQuestionsByQuizId(quizId);
        const orderIndex = dto.order_index !== undefined ? dto.order_index : questions.length;
        const qId = `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const newQuestion = {
            id: qId,
            quiz_id: quizId,
            question_text: dto.question_text,
            options: dto.options,
            correct_answer: dto.correct_answer,
            explanation: dto.explanation || null,
            source_pages: dto.source_pages || [],
            order_index: orderIndex,
            created_at: new Date().toISOString()
        };
        this.questions.set(qId, newQuestion);
        quiz.question_count = questions.length + 1;
        return newQuestion;
    }
    async updateQuestion(questionId, dto) {
        const question = this.questions.get(questionId);
        if (!question)
            throw new Error(`Question ${questionId} not found`);
        if (dto.question_text !== undefined)
            question.question_text = dto.question_text;
        if (dto.options !== undefined)
            question.options = dto.options;
        if (dto.correct_answer !== undefined)
            question.correct_answer = dto.correct_answer;
        if (dto.explanation !== undefined)
            question.explanation = dto.explanation;
        if (dto.source_pages !== undefined)
            question.source_pages = dto.source_pages;
        this.questions.set(questionId, question);
        return question;
    }
    async deleteQuestion(questionId) {
        const question = this.questions.get(questionId);
        if (!question)
            return false;
        this.questions.delete(questionId);
        const quiz = this.quizzes.get(question.quiz_id);
        if (quiz) {
            const remaining = await this.getQuestionsByQuizId(quiz.id);
            quiz.question_count = remaining.length;
        }
        return true;
    }
    async reorderQuestions(quizId, questionIds) {
        questionIds.forEach((id, index) => {
            const q = this.questions.get(id);
            if (q && q.quiz_id === quizId) {
                q.order_index = index;
                this.questions.set(id, q);
            }
        });
        return true;
    }
}
