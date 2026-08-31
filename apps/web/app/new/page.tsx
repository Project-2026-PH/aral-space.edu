'use client';

import React, { useState, useEffect } from 'react';
import ManualQuizCreator from '@/components/quiz/ManualQuizCreator';
import { Subject } from '@quiz-creator/types';

export default function NewQuizPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/api/quizzes');
        if (res.ok) {
          const data = await res.json();
          setSubjects(data.subjects || []);
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
      }
    }
    loadSubjects();
  }, []);

  return <ManualQuizCreator subjects={subjects} />;
}
