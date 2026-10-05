export type SceneTemplate = 'flow' | 'layers' | 'compare' | 'cycle';
export type SceneReaction = 'idle' | 'surprised' | 'happy';

export type SceneNode = {
  id: string;
  label: string;
  kind?: 'concept' | 'input' | 'output' | 'warning' | 'choice';
};

export type SceneStep = {
  highlight: string;
  caption: string;
  reaction?: SceneReaction;
};

export type StudyScene = {
  template: SceneTemplate;
  nodes: SceneNode[];
  steps: SceneStep[];
};

export type SceneCardContext = {
  quizId: string;
  questionId: string;
  question: string;
  answer: string;
  explanation?: string;
};
