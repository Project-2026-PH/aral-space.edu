'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import ManualQuizCreator from '@/components/quiz/ManualQuizCreator';

const GenerateQuizModal = dynamic(() => import('@/components/quiz/GenerateQuizModal'), {
  ssr: false,
});

export default function NewQuizPage() {
  const [showAiModal, setShowAiModal] = useState(false);

  return (
    <>
      <ManualQuizCreator onSwitchToAi={() => setShowAiModal(true)} />
      <GenerateQuizModal open={showAiModal} onOpenChange={setShowAiModal} />
    </>
  );
}
