export type RuleType = 'spelling' | 'grammar' | 'style';

export interface GrammarIssue {
  id: string;
  from: number;
  to: number;
  originalText: string;
  message: string;
  replacements: string[];
  ruleType: RuleType;
  ruleCategory?: string;
}

export interface GrammarCheckResponse {
  issues: GrammarIssue[];
  source?: 'languagetool' | 'local';
}
