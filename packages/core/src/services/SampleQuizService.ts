import { CreateQuestionDto, Quiz, QuizQuestion, Subject } from '@quiz-creator/types';

export const SAMPLE_SUBJECT_ID = 'sub-cognitive-mastery';
export const SAMPLE_QUIZ_ID = 'quiz-cognitive-mastery-sample';
export const SAMPLE_SHARE_TOKEN = 'cognitive-mastery-sample';

export const SAMPLE_SUBJECT: Subject = {
  id: SAMPLE_SUBJECT_ID,
  name: 'Cognitive Science & Mastery',
  color: '#6366f1',
  share_token: 'subject-cognitive-mastery',
  is_public: true,
  created_at: '2026-01-01T00:00:00.000Z'
};

export const SAMPLE_QUIZ: Quiz = {
  id: SAMPLE_QUIZ_ID,
  title: 'Cognitive Mastery Loop (Active Error Queue & Elaborative Feedback)',
  description: 'Hands-on practice quiz testing the 7-item dynamic sliding window, 3-position Leitner reinsertion, 3-second pre-commitment delay, and Anti-Fatigue Struggle Pile.',
  question_count: 8,
  generated_at: '2026-01-01T00:00:00.000Z',
  handout_name: 'Cognitive Mastery Loop Architecture Specification',
  source_model: 'pedagogy_engine',
  subject_id: SAMPLE_SUBJECT_ID,
  share_token: SAMPLE_SHARE_TOKEN,
  is_public: true,
  allow_cloning: true,
  created_at: '2026-01-01T00:00:00.000Z',
  subject: SAMPLE_SUBJECT
};

export const SAMPLE_QUESTIONS: CreateQuestionDto[] = [
  {
    question_text: "What is the primary function of the 7-item dynamic sliding window in the active error queue?",
    options: [
      "Maintains focus within human working memory limits while steadily cycling active concepts",
      "Forces every question in the entire quiz to be answered simultaneously",
      "Limits the maximum number of questions a user can study per day",
      "Randomly shuffles questions without tracking error frequency"
    ],
    correct_answer: 0,
    explanation: "Miller's Law establishes that working memory can hold approximately 7 items. The sliding window keeps active review focused on this capacity.",
    correct_explanation: "Working memory is biologically constrained to 7±2 chunks; restricting active queue size prevents cognitive overload while reinforcing error items.",
    distractor_explanations: {
      1: "Presenting all questions simultaneously causes working memory thrashing and cognitive overload.",
      2: "Daily study volume is unrestricted; the 7-item constraint only governs the concurrent active working buffer.",
      3: "Random shuffling without tracking destroys the error-priority queue and invalidates spaced repetition."
    },
    discriminatory_keywords: ["working memory capacity", "sliding window", "cognitive load", "buffer"],
    source_pages: [1],
    order_index: 0
  },
  {
    question_text: "In Leitner-style reinsertion, how does the engine position a question immediately after an incorrect answer?",
    options: [
      "Reinserts the card 3–4 positions ahead in the active queue",
      "Pushes the card to the very end of the entire quiz deck",
      "Permanently deletes the question from the practice session",
      "Immediately repeats the question on the very next screen without spacing"
    ],
    correct_answer: 0,
    explanation: "Reinserting 3–4 positions ahead provides an optimal delay for working memory to clear while enabling timely retrieval practice.",
    correct_explanation: "Immediate re-testing triggers perceptual recognition rather than true memory retrieval; spacing 3 positions ahead forces semantic recall.",
    distractor_explanations: {
      1: "Sending a missed card to the very back of a large deck delays review too long, causing complete forgetting.",
      2: "Deleting the card abandons the concept instead of achieving mastery.",
      3: "Immediate repetition without intermediate items merely tests short-term sensory echo rather than long-term semantic retrieval."
    },
    discriminatory_keywords: ["spaced reinsertion", "retrieval spacing", "recognition heuristic", "Leitner"],
    source_pages: [1],
    order_index: 1
  },
  {
    question_text: "Why does the practice runner enforce a 3-second pre-commitment delay ('Think First') before revealing multiple-choice options?",
    options: [
      "Forces semantic memory retrieval before scanning distractors to prevent the passive recognition heuristic",
      "Compensates for slow network latency from the server database",
      "Prevents fast readers from completing quizzes too quickly",
      "Allows background sound effects to finish playing"
    ],
    correct_answer: 0,
    explanation: "The pre-commitment delay forces active recall from long-term memory before options can provide unintended recognition cues.",
    correct_explanation: "When options appear instantly, learners scan for familiar words (recognition heuristic); a 3-second delay forces internal memory generation.",
    distractor_explanations: {
      1: "The delay is an intentional pedagogical technique, completely independent of network latency.",
      2: "The objective is cognitive depth and memory retention, not arbitrary pacing or slowing down reading speed.",
      3: "Audio effects are asynchronous and do not dictate the retrieval pedagogical timer."
    },
    discriminatory_keywords: ["pre-commitment", "forced retrieval", "recognition heuristic", "semantic memory"],
    source_pages: [2],
    order_index: 2
  },
  {
    question_text: "What trigger activates the Anti-Fatigue Guardrail ('Struggle Pile') for a card during an active session?",
    options: [
      "Failing the same card 3 times in a single session",
      "Taking longer than 60 seconds to answer any single question",
      "Answering 5 consecutive questions correctly",
      "Exiting the session before all batches are complete"
    ],
    correct_answer: 0,
    explanation: "After 3 consecutive or accumulated misses on a single card, continuing to loop it causes cognitive exhaustion and rage-quitting.",
    correct_explanation: "A 3-attempt ceiling prevents repetitive failure loops and extracts persistent problem cards into a dedicated Struggle Pile for later targeted review.",
    distractor_explanations: {
      1: "Response latency does not trigger escalation; only repeated failure attempts trigger the struggle guardrail.",
      2: "Consecutive correct answers advance mastery and lock questions rather than escalating to struggle.",
      3: "Exiting a session pauses or preserves state, but does not move cards to the Struggle Pile."
    },
    discriminatory_keywords: ["attempt cap", "struggle pile", "fatigue guardrail", "burnout prevention"],
    source_pages: [2],
    order_index: 3
  },
  {
    question_text: "How does Elaborative Feedback differ from simple correctness confirmation in multiple-choice quizzes?",
    options: [
      "Explains specific conceptual fallacies for distractors and highlights discriminatory keywords separating options",
      "Only shows a green checkmark or red X without explaining reasons",
      "Provides hints before the question is answered",
      "Decreases the difficulty of subsequent questions automatically"
    ],
    correct_answer: 0,
    explanation: "Elaborative feedback decomposes why distractors are plausible misconceptions and identifies the decisive technical keywords.",
    correct_explanation: "Deep conceptual discrimination requires explaining why near-miss distractors fail and highlighting defining keywords.",
    distractor_explanations: {
      1: "Simple binary right/wrong confirmation provides minimal pedagogical learning signal.",
      2: "Hints prior to answering diminish retrieval effort and weaken active recall pathways.",
      3: "Adjusting question difficulty dynamically is adaptive testing, not elaborative conceptual feedback."
    },
    discriminatory_keywords: ["elaborative feedback", "distractor fallacies", "discriminatory keywords", "conceptual discrimination"],
    source_pages: [3],
    order_index: 4
  },
  {
    question_text: "When does a batch or round achieve the Mastery Completion Criteria in the Cognitive Mastery Loop?",
    options: [
      "When every card in the active batch has either been answered correctly at least once or moved to the Struggle Pile",
      "As soon as 50% of the questions have been attempted once",
      "When the countdown timer for the entire session reaches zero",
      "Only after answering all questions 5 times in a row without a single error"
    ],
    correct_answer: 0,
    explanation: "A round only concludes when the active working queue is emptied by either achieving correct retrieval or escalating to the struggle pile.",
    correct_explanation: "Active error queues require 100% resolution (mastery or struggle escalation) before advancing to the next batch.",
    distractor_explanations: {
      1: "Partial attempts leave unresolved errors uncorrected in working memory.",
      2: "The loop is governed by mastery completion, not a strict countdown time limit.",
      3: "Requiring 5 error-free repeats causes overlearning and excessive cognitive fatigue."
    },
    discriminatory_keywords: ["mastery criteria", "queue resolution", "batch completion", "active queue exhaustion"],
    source_pages: [3],
    order_index: 5
  },
  {
    question_text: "What happens when a question in the Struggle Pile is reviewed after the main session finishes?",
    options: [
      "It enters a focused targeted review round with a fresh attempt counter",
      "It is permanently archived and can never be practiced again",
      "It is automatically counted as 100% mastered without review",
      "The user's entire quiz score is reset to zero"
    ],
    correct_answer: 0,
    explanation: "The Struggle Pile enables targeted deliberate practice on the specific concepts that caused difficulty during the main session.",
    correct_explanation: "Segregating struggle cards allows learners to rest, recover, and then tackle hard concepts with isolated focus.",
    distractor_explanations: {
      1: "Struggle cards are highlighted for targeted study, not deleted or archived.",
      2: "Mastery requires active demonstration; cards cannot be marked mastered without correct retrieval.",
      3: "Prior mastered cards remain locked and scored; only the struggle cards are re-queued."
    },
    discriminatory_keywords: ["targeted review", "deliberate practice", "struggle review", "isolated focus"],
    source_pages: [4],
    order_index: 6
  },
  {
    question_text: "Which cognitive principle underlies the discriminatory keywords feature in question feedback?",
    options: [
      "Feature contrast: identifying the critical semantic boundaries that distinguish a target concept from similar alternatives",
      "Rote memorization: repeating dictionary definitions verbatim until stored",
      "Subliminal priming: flashing keywords to encourage subconscious guessing",
      "Confirmation bias: reinforcing whatever option the student initially guessed"
    ],
    correct_answer: 0,
    explanation: "Expert knowledge is characterized by fine-grained feature contrast that quickly distinguishes confusing concepts.",
    correct_explanation: "Discriminatory keywords highlight the boundary conditions and critical attributes separating correct principles from distractors.",
    distractor_explanations: {
      1: "Rote memorization lacks conceptual discrimination and fails in applied or transfer scenarios.",
      2: "Subliminal priming is pseudoscientific and does not foster semantic comprehension.",
      3: "Confirmation bias impedes error correction; feedback must challenge false assumptions."
    },
    discriminatory_keywords: ["feature contrast", "semantic boundary", "boundary conditions", "conceptual discrimination"],
    source_pages: [4],
    order_index: 7
  }
];

export const SAMPLE_QUIZ_QUESTIONS: QuizQuestion[] = SAMPLE_QUESTIONS.map((q, idx) => {
  const options = q.options || [];
  const correctAnswer = q.correct_answer ?? 0;
  return {
    id: `q-cognitive-mastery-${idx + 1}`,
    quiz_id: SAMPLE_QUIZ_ID,
    question_text: q.question_text,
    answer_text: options[correctAnswer] || '',
    question_type: 'multiple_choice',
    options,
    correct_answer: correctAnswer,
    explanation: q.explanation || null,
    correct_explanation: q.correct_explanation || null,
    distractor_explanations: q.distractor_explanations || null,
    discriminatory_keywords: q.discriminatory_keywords || null,
    source_pages: q.source_pages || [],
    order_index: idx,
    created_at: '2026-01-01T00:00:00.000Z'
  };
});

export class SampleQuizService {
  static getSampleData() {
    return {
      subject: SAMPLE_SUBJECT,
      quiz: SAMPLE_QUIZ,
      questions: SAMPLE_QUESTIONS,
      quizQuestions: SAMPLE_QUIZ_QUESTIONS
    };
  }

  static getSampleQuiz(): Quiz {
    return { ...SAMPLE_QUIZ };
  }

  static getSampleSubject(): Subject {
    return { ...SAMPLE_SUBJECT };
  }

  static getSampleQuestions(): QuizQuestion[] {
    return [...SAMPLE_QUIZ_QUESTIONS];
  }
}
