export class QuizRenamingService {
    static sortQuizzesNaturally(quizzes) {
        return [...quizzes].sort((a, b) => {
            return a.title.localeCompare(b.title, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });
    }
    static formatHandoutTitle(handoutName) {
        return handoutName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    }
}
