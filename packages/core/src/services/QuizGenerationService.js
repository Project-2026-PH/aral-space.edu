import { GoogleGenAI, Type } from '@google/genai';
export class QuizGenerationService {
    static sanitizeJsonString(str) {
        let cleaned = str.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.slice(7);
        }
        else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
        }
        cleaned = cleaned.trim();
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            cleaned = cleaned.substring(firstBracket, lastBracket + 1);
        }
        return cleaned;
    }
    static validateQuestions(questions) {
        if (!Array.isArray(questions) || questions.length === 0)
            return false;
        return questions.every((q) => {
            return (typeof q.question === 'string' &&
                q.question.trim().length > 0 &&
                Array.isArray(q.options) &&
                q.options.length === 4 &&
                q.options.every((opt) => typeof opt === 'string' && opt.trim().length > 0) &&
                typeof q.correct_answer === 'number' &&
                q.correct_answer >= 0 &&
                q.correct_answer <= 3 &&
                typeof q.explanation === 'string' &&
                q.explanation.trim().length > 0);
        });
    }
    static buildPrompt(pages, subjectName) {
        const formattedContent = pages
            .map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}\n`)
            .join('\n');
        return `You are an expert exam-prep question author${subjectName ? ` for ${subjectName}` : ''}.
Generate a comprehensive, rigorous multiple-choice quiz based ONLY on the source text provided below.

Source Material:
${formattedContent}

Requirements:
1. Target: Exactly 15-20 challenging, concept-testing multiple choice questions.
2. Each question MUST have exactly 4 plausible options.
3. correct_answer is the 0-indexed position (0, 1, 2, or 3) of the correct choice.
4. explanation MUST cite why the answer is correct according to the text.
5. source_pages MUST be an array of page numbers where the concept appears.
`;
    }
    async generateQuiz(options) {
        const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            // Fallback mock questions if no API key configured
            return {
                sourceModel: 'mock-gemini-2.5-flash',
                tokensUsed: 450,
                questions: [
                    {
                        question: "What is the primary role of active recall in learning?",
                        options: [
                            "Strengthens memory neural pathways through retrieval practice",
                            "Passive re-reading of textbooks",
                            "Highlighting notes with multiple colors",
                            "Listening to lectures in background"
                        ],
                        correct_answer: 0,
                        explanation: "Active recall actively stimulates memory retrieval and strengthens long-term neural pathways.",
                        source_pages: [options.pageStart || 1]
                    },
                    {
                        question: "Why does the Mastery Loop lock questions after successful streaks?",
                        options: [
                            "To prevent endless loops once a concept is proven mastered",
                            "To delete questions permanently",
                            "To disable feedback",
                            "To reduce score"
                        ],
                        correct_answer: 0,
                        explanation: "Locking prevents repetitive overlearning during a single active session.",
                        source_pages: [options.pageStart || 1]
                    },
                    {
                        question: "What is the optimal spacing between Initial practice and First Review?",
                        options: ["24 hours", "10 minutes", "1 month", "Same hour"],
                        correct_answer: 0,
                        explanation: "24 hours is the optimal interval to consolidate short-term to long-term memory according to the Ebbinghaus forgetting curve.",
                        source_pages: [options.pageStart || 1]
                    }
                ]
            };
        }
        const ai = new GoogleGenAI({ apiKey });
        const prompt = QuizGenerationService.buildPrompt(options.handoutPages, options.subjectName);
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    correct_answer: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    source_pages: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER }
                    }
                },
                required: ["question", "options", "correct_answer", "explanation"]
            }
        };
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.3
            }
        });
        let fullText = '';
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                options.onChunk?.(chunkText);
            }
        }
        const sanitized = QuizGenerationService.sanitizeJsonString(fullText);
        const parsed = JSON.parse(sanitized);
        if (!QuizGenerationService.validateQuestions(parsed)) {
            throw new Error("Generated quiz JSON did not match expected structure");
        }
        return {
            questions: parsed,
            sourceModel: 'gemini-2.5-flash',
            tokensUsed: Math.ceil(fullText.length / 4)
        };
    }
}
