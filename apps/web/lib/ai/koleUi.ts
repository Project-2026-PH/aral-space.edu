export type KoleUiChoice = {
  id: string;
  label: string;
  description?: string;
  prompt: string;
};

export type KoleUiBlock =
  | {
      type: 'choice_cards';
      title: string;
      description?: string;
      options: KoleUiChoice[];
    }
  | {
      type: 'study_timer';
      title: string;
      minutes: number;
      focus: string;
    };

export type KoleUiResponse = {
  reply: string;
  ui: KoleUiBlock[];
};

export function isKoleUiBlock(value: unknown): value is KoleUiBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  if (block.type === 'study_timer') {
    return typeof block.title === 'string'
      && typeof block.focus === 'string'
      && typeof block.minutes === 'number';
  }
  if (block.type !== 'choice_cards' || typeof block.title !== 'string' || !Array.isArray(block.options)) return false;
  return block.options.every((option) => {
    if (!option || typeof option !== 'object') return false;
    const choice = option as Record<string, unknown>;
    return typeof choice.id === 'string'
      && typeof choice.label === 'string'
      && typeof choice.prompt === 'string';
  });
}
