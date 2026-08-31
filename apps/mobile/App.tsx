import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, StatusBar } from 'react-native';
import { Quiz, QuizQuestion, QuizSession, QuestionProgress } from '@quiz-creator/types';
import { RepositoryFactory, MasteryEngineService, QuizShuffleService } from '@quiz-creator/core';

export default function App() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    async function loadQuizzes() {
      // Uses the local-first/memory repository from @quiz-creator/core
      const repo = RepositoryFactory.createQuizRepository();
      const list = await repo.listQuizzes();
      setQuizzes(list);
    }
    loadQuizzes();
  }, []);

  async function startQuiz(quiz: Quiz) {
    const repo = RepositoryFactory.createQuizRepository();
    const qList = await repo.getQuestionsByQuizId(quiz.id);
    setActiveQuiz(quiz);
    setQuestions(qList);
    setActiveQuestionIndex(0);
    setSelectedOption(null);
    setStreak(0);
  }

  function handleAnswer(index: number) {
    if (selectedOption !== null || !currentQuestion) return;
    setSelectedOption(index);
    const isCorrect = index === currentQuestion.correct_answer;
    if (isCorrect) {
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    setTimeout(() => {
      setSelectedOption(null);
      if (activeQuestionIndex < questions.length - 1) {
        setActiveQuestionIndex((prev) => prev + 1);
      } else {
        // Reset or finish
        setActiveQuestionIndex(0);
      }
    }, 1200);
  }

  const currentQuestion = questions[activeQuestionIndex];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>QuizMaster Mobile</Text>
        <Text style={styles.subtitle}>Spaced Repetition Mastery Engine</Text>
      </View>

      {!activeQuiz ? (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionHeader}>Available Decks</Text>
          {quizzes.map((q) => (
            <TouchableOpacity key={q.id} style={styles.card} onPress={() => startQuiz(q)}>
              <Text style={styles.cardTitle}>{q.title}</Text>
              <Text style={styles.cardCount}>{q.question_count} Questions</Text>
              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>Start Practice</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.practiceContainer}>
          <View style={styles.quizHeader}>
            <TouchableOpacity onPress={() => setActiveQuiz(null)}>
              <Text style={styles.backButton}>← Exit</Text>
            </TouchableOpacity>
            <Text style={styles.streakBadge}>🔥 Streak: {streak}</Text>
          </View>

          {currentQuestion && (
            <View style={styles.questionCard}>
              <Text style={styles.progressText}>
                Question {activeQuestionIndex + 1} of {questions.length}
              </Text>
              <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

              <View style={styles.optionsContainer}>
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQuestion.correct_answer;
                  let optStyle = styles.option;

                  if (selectedOption !== null) {
                    if (isCorrect) optStyle = styles.optionCorrect;
                    else if (isSelected && !isCorrect) optStyle = styles.optionWrong;
                  }

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={optStyle}
                      onPress={() => handleAnswer(idx)}
                      disabled={selectedOption !== null}
                    >
                      <Text style={styles.optionText}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedOption !== null && currentQuestion.explanation && (
                <Text style={styles.explanationText}>💡 {currentQuestion.explanation}</Text>
              )}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  cardCount: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  playButton: {
    marginTop: 16,
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  practiceContainer: {
    flex: 1,
    padding: 20,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  streakBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 24,
    marginBottom: 20,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionCorrect: {
    backgroundColor: '#dcfce7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  optionWrong: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  explanationText: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
