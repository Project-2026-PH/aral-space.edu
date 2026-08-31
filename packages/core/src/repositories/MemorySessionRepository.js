export class MemorySessionRepository {
    sessions = new Map();
    progress = new Map();
    async getActiveSession(quizId) {
        for (const session of this.sessions.values()) {
            if (session.quiz_id === quizId && session.status === 'in_progress') {
                return session;
            }
        }
        return null;
    }
    async getScheduledSession(quizId) {
        for (const session of this.sessions.values()) {
            if (session.quiz_id === quizId && session.status === 'scheduled') {
                return session;
            }
        }
        return null;
    }
    async getLatestCompletedSession(quizId) {
        const completed = [];
        for (const session of this.sessions.values()) {
            if (session.quiz_id === quizId && session.status === 'completed') {
                completed.push(session);
            }
        }
        if (completed.length === 0)
            return null;
        return completed.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())[0];
    }
    async listSessions(quizId) {
        const list = [];
        for (const session of this.sessions.values()) {
            if (session.quiz_id === quizId)
                list.push(session);
        }
        return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    async createSession(quizId, sessionType, availableAt, userId) {
        const id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const session = {
            id,
            quiz_id: quizId,
            user_id: userId || null,
            session_type: sessionType,
            status: 'in_progress',
            available_at: availableAt || new Date().toISOString(),
            started_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        this.sessions.set(id, session);
        return session;
    }
    async updateSessionStatus(sessionId, status, completedAt) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Session ${sessionId} not found`);
        session.status = status;
        if (completedAt)
            session.completed_at = completedAt;
        this.sessions.set(sessionId, session);
        return session;
    }
    async getProgressForSession(sessionId) {
        const list = [];
        for (const p of this.progress.values()) {
            if (p.session_id === sessionId)
                list.push(p);
        }
        return list;
    }
    async saveQuestionProgress(p) {
        const key = `${p.session_id}_${p.question_id}`;
        const id = p.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const updated = { ...p, id };
        this.progress.set(key, updated);
        return updated;
    }
    async batchSaveQuestionProgress(progressList) {
        const saved = [];
        for (const item of progressList) {
            saved.push(await this.saveQuestionProgress(item));
        }
        return saved;
    }
}
