'use client';

import React, { useState } from 'react';
import ManualQuizCreator from '@/components/quiz/ManualQuizCreator';
import GenerateQuizModal from '@/components/quiz/GenerateQuizModal';

export default function NewQuizPage() {
  const [showAiModal, setShowAiModal] = useState(false);

  return (
    <>
      <ManualQuizCreator onSwitchToAi={() => setShowAiModal(true)} />
      <GenerateQuizModal open={showAiModal} onOpenChange={setShowAiModal} />
    </>
  );
}
