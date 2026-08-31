export class QuizShuffleService {
    static shuffleOptions(options, correctAnswerIndex, previousOrder) {
        const indexed = options.map((text, idx) => ({
            optionId: idx,
            text,
            isCorrect: idx === correctAnswerIndex
        }));
        if (indexed.length <= 1)
            return indexed;
        let shuffled = [...indexed];
        // Fisher-Yates Shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        // Avoid exact same order if prev order given
        if (previousOrder && previousOrder.length === options.length) {
            const currentOrder = shuffled.map((o) => o.optionId);
            const isIdentical = currentOrder.every((val, idx) => val === previousOrder[idx]);
            if (isIdentical && shuffled.length > 1) {
                [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
            }
        }
        return shuffled;
    }
}
