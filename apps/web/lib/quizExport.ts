import type { Quiz, QuizQuestion } from '@quiz-creator/types';

export interface QuizExportQuestion {
  question_text: string;
  answer_text: string;
  question_type: string;
  options: string[];
  explanation: string;
  source_pages: number[];
}

export interface QuizExportDocument {
  format: 'quiz-creator-reviewer';
  version: 1;
  title: string;
  description: string;
  questions: QuizExportQuestion[];
}

function getAnswerText(question: QuizQuestion): string {
  return question.answer_text?.trim() || question.options[question.correct_answer]?.trim() || '';
}

function getQuestionType(question: QuizQuestion): string {
  return question.question_type || (question.options.length > 1 ? 'multiple_choice' : 'typed_answer');
}

export function buildQuizExportDocument(
  quiz: Quiz,
  questions: QuizQuestion[]
): QuizExportDocument {
  return {
    format: 'quiz-creator-reviewer',
    version: 1,
    title: quiz.title,
    description: quiz.description?.trim() || '',
    questions: questions.map((question) => ({
      question_text: question.question_text,
      answer_text: getAnswerText(question),
      question_type: getQuestionType(question),
      options: question.options,
      explanation: question.explanation?.trim() || '',
      source_pages: question.source_pages || []
    }))
  };
}

export function buildQuizJson(quiz: Quiz, questions: QuizQuestion[]): string {
  return JSON.stringify(buildQuizExportDocument(quiz, questions), null, 2);
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildQuizCsv(quiz: Quiz, questions: QuizQuestion[]): string {
  const document = buildQuizExportDocument(quiz, questions);
  const headers = [
    'question_text',
    'answer_text',
    'question_type',
    'options',
    'explanation',
    'source_pages'
  ];
  const rows = document.questions.map((question) => [
    question.question_text,
    question.answer_text,
    question.question_type,
    JSON.stringify(question.options),
    question.explanation,
    question.source_pages.join('|')
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n') + '\r\n';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[character];
  });
}

export function buildQuizPrintDocument(quiz: Quiz, questions: QuizQuestion[]): string {
  const document = buildQuizExportDocument(quiz, questions);
  const description = document.description
    ? `<p class="description">${escapeHtml(document.description)}</p>`
    : '';
  const questionMarkup = document.questions
    .map((question, index) => {
      const options = question.options.length > 1
        ? `<ul>${question.options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}</ul>`
        : '';
      const explanation = question.explanation
        ? `<p class="explanation"><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</p>`
        : '';

      return `
        <article class="question">
          <h2>Question ${index + 1}</h2>
          <p class="prompt">${escapeHtml(question.question_text)}</p>
          ${options}
          <p class="answer"><strong>Answer:</strong> ${escapeHtml(question.answer_text)}</p>
          ${explanation}
        </article>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(document.title)} - Quiz Export</title>
    <style>
      @page { margin: 18mm; }
      * { box-sizing: border-box; }
      body { color: #172033; font-family: Arial, sans-serif; line-height: 1.5; margin: 0; }
      h1 { font-size: 24px; margin: 0 0 4px; }
      h2 { border-bottom: 1px solid #d8dee9; font-size: 15px; margin: 0 0 10px; padding-bottom: 5px; }
      .description { color: #536174; margin: 0 0 22px; }
      .question { border: 1px solid #d8dee9; border-radius: 8px; margin: 0 0 14px; padding: 14px; page-break-inside: avoid; }
      .prompt { font-size: 14px; margin: 0 0 8px; white-space: pre-wrap; }
      ul { margin: 6px 0 10px 20px; padding: 0; }
      .answer { background: #eef8f1; border-radius: 5px; margin: 10px 0 0; padding: 7px 9px; }
      .explanation { color: #536174; font-size: 12px; margin: 8px 0 0; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(document.title)}</h1>
    ${description}
    ${questionMarkup}
  </body>
</html>`;
}

export function getQuizExportFilename(title: string, extension: string): string {
  const safeTitle = title
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'quiz';
  return `${safeTitle}.${extension}`;
}

export function downloadQuizText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
