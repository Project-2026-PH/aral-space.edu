import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { AiModelConfig } from '@quiz-creator/core/services';
import { runLocalGrammarRules } from '@/lib/grammar/localRules';
import { GrammarCheckResponse, GrammarIssue, RuleType } from '@/lib/grammar/types';

interface LanguageToolReplacement {
  value: string;
}

interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements: LanguageToolReplacement[];
  rule: {
    id: string;
    description: string;
    issueType?: string;
    category?: {
      id?: string;
      name?: string;
    };
  };
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[];
}

export async function POST(req: NextRequest): Promise<NextResponse<GrammarCheckResponse>> {
  try {
    const body = await req.json();
    const text = typeof body?.text === 'string' ? body.text : '';

    if (!text.trim()) {
      return NextResponse.json({ issues: [] });
    }

    // 1. Attempt Groq high-accuracy neural grammar engine if configured
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const completion = await groq.chat.completions.create(
          {
            model: AiModelConfig.getGroqModel(),
            messages: [
              {
                role: 'system',
                content: `You are an expert grammar and copy editing engine like Google Docs.
Analyze the user's text for:
- Grammatical errors (subject-verb agreement, verb tense, broken syntax, wrong preposition, missing words)
- Spelling errors & typos
- Word choice & awkward phrasing (e.g. non-standard words like "Effectivity" -> "Effectiveness")

Return a JSON object with this exact schema:
{
  "issues": [
    {
      "originalText": "exact verbatim substring from text",
      "message": "concise explanation of the error",
      "replacements": ["suggested replacement"],
      "ruleType": "spelling" | "grammar" | "style"
    }
  ]
}

CRITICAL RULES:
- "originalText" MUST match the exact casing and characters in the input text.
- Target only specific faulty words or clauses, NOT the entire paragraph.
- Return {"issues": []} if the text is already grammatically sound.
- Output valid JSON only.`
              },
              {
                role: 'user',
                content: text
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1000
          },
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        const raw = completion.choices[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
            const issues: GrammarIssue[] = [];
            let searchIndex = 0;
            for (const item of parsed.issues) {
              if (!item.originalText || typeof item.originalText !== 'string') continue;
              const idx = text.indexOf(item.originalText, searchIndex);
              const foundIdx = idx !== -1 ? idx : text.indexOf(item.originalText);
              if (foundIdx !== -1) {
                issues.push({
                  id: `ai-${foundIdx}-${foundIdx + item.originalText.length}`,
                  from: foundIdx,
                  to: foundIdx + item.originalText.length,
                  originalText: item.originalText,
                  message: item.message || 'Grammar suggestion',
                  replacements: Array.isArray(item.replacements) ? item.replacements.slice(0, 3) : [],
                  ruleType: item.ruleType || 'grammar'
                });
                searchIndex = foundIdx + item.originalText.length;
              }
            }
            if (issues.length > 0) {
              issues.sort((a, b) => a.from - b.from);
              return NextResponse.json({ issues, source: 'languagetool' });
            }
          }
        }
      } catch (err) {
        console.warn('Groq grammar check failed, falling back to rule engine:', err);
      }
    }

    // 2. Attempt LanguageTool API with 2.5s abort timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const params = new URLSearchParams();
      params.append('text', text);
      params.append('language', 'en-US');

      const ltRes = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json'
        },
        body: params.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (ltRes.ok) {
        const data = (await ltRes.json()) as LanguageToolResponse;
        const issues: GrammarIssue[] = (data.matches || []).map((match, idx) => {
          const originalText = text.substring(match.offset, match.offset + match.length);
          const issueType = (match.rule.issueType || '').toLowerCase();
          const catId = (match.rule.category?.id || '').toUpperCase();

          let ruleType: RuleType = 'grammar';
          if (issueType === 'misspelling' || catId === 'TYPOS') {
            ruleType = 'spelling';
          } else if (catId === 'STYLE' || catId === 'REDUNDANCY' || issueType === 'style') {
            ruleType = 'style';
          }

          return {
            id: `lt-${match.offset}-${match.offset + match.length}-${idx}`,
            from: match.offset,
            to: match.offset + match.length,
            originalText,
            message: match.message,
            replacements: (match.replacements || []).slice(0, 4).map((r) => r.value),
            ruleType,
            ruleCategory: match.rule.category?.name || match.rule.description
          };
        });

        // Merge in local rules
        const localIssues = runLocalGrammarRules(text);
        const merged = [...issues];
        for (const loc of localIssues) {
          const overlaps = merged.some(
            (m) => (loc.from >= m.from && loc.from < m.to) || (loc.to > m.from && loc.to <= m.to)
          );
          if (!overlaps) {
            merged.push(loc);
          }
        }
        merged.sort((a, b) => a.from - b.from);

        return NextResponse.json({ issues: merged, source: 'languagetool' });
      }
    } catch {
      // LanguageTool failed or timed out, fallback to local deterministic rule engine
    }

    // 3. Fallback: local rule engine
    const localIssues = runLocalGrammarRules(text);
    return NextResponse.json({ issues: localIssues, source: 'local' });
  } catch (error) {
    console.error('Grammar check route error:', error);
    return NextResponse.json({ issues: [], source: 'local' });
  }
}
