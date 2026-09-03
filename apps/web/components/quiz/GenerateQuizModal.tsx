'use client';

import React from 'react';
import Modal from '../ui/Modal';
import { useRouter } from 'next/navigation';
import AiQuizGenerator from './AiQuizGenerator';

interface GenerateQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects?: Array<{ id: string; name: string; color?: string }>;
  onGenerated?: (quizId: string) => void;
}

export default function GenerateQuizModal({
  open,
  onOpenChange,
  subjects,
  onGenerated
}: GenerateQuizModalProps) {
  const router = useRouter();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Generate your Quiz with Us!"
      description="Paste lecture notes, study guides, or topic summaries to generate questions."
    >
      <AiQuizGenerator
        isModal={true}
        subjects={subjects}
        onGenerated={(quizId) => {
          onOpenChange(false);
          if (onGenerated) {
            onGenerated(quizId);
          } else {
            router.push(`/quizzes/${quizId}`);
          }
        }}
        onCancel={() => onOpenChange(false)}
      />
    </Modal>
  );
}

