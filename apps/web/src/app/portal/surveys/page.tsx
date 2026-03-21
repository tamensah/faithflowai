'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

type SurveyAnswerState = Record<string, Record<string, any>>;

const hasValue = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
};

export default function SurveysPage() {
  const { data: selfProfile } = trpc.member.selfProfile.useQuery(undefined, { retry: false });
  const churchId = selfProfile?.member?.churchId;

  const { data: surveys } = trpc.survey.listActive.useQuery(
    { churchId },
    { enabled: Boolean(churchId) }
  );

  const [answers, setAnswers] = useState<SurveyAnswerState>({});
  const [surveyErrors, setSurveyErrors] = useState<Record<string, string>>({});

  const { mutate: submitSurvey } = trpc.survey.submitSelfResponse.useMutation();

  const surveyQuestions = useMemo(() => {
    const map: Record<string, any[]> = {};
    surveys?.forEach((survey) => {
      map[survey.id] = survey.questions ?? [];
    });
    return map;
  }, [surveys]);

  const isSurveyQuestionAnswered = (question: any, value: unknown) => {
    if (question.type === 'RATING') {
      const numeric = typeof value === 'string' ? Number(value) : value;
      return Number.isFinite(numeric) && Number(numeric) >= 1 && Number(numeric) <= 5;
    }
    return hasValue(value);
  };

  const handleAnswerChange = (surveyId: string, questionId: string, value: any) => {
    setSurveyErrors((prev) => {
      if (!prev[surveyId]) return prev;
      const next = { ...prev };
      delete next[surveyId];
      return next;
    });
    setAnswers((prev) => ({
      ...prev,
      [surveyId]: { ...(prev[surveyId] ?? {}), [questionId]: value },
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Surveys</h2>
        <p className="text-sm text-muted">Respond to active church surveys.</p>
      </div>

      {surveys?.map((survey) => {
        const questions = surveyQuestions[survey.id] ?? [];
        const missingRequiredQuestions = questions
          .filter((q: any) => q.required)
          .filter((q: any) => !isSurveyQuestionAnswered(q, answers[survey.id]?.[q.id]))
          .map((q: any) => q.prompt);
        const canSubmitSurvey = missingRequiredQuestions.length === 0;
        const surveyError = surveyErrors[survey.id];

        return (
          <Card key={survey.id} className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{survey.title}</h3>
              <Badge variant="default">{survey.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{survey.description ?? 'No description.'}</p>

            <div className="mt-4 space-y-3">
              {questions.map((question: any) => (
                <div key={question.id} className="space-y-2">
                  <p className="text-sm font-medium">
                    {question.prompt}
                    {question.required ? ' *' : ''}
                  </p>
                  {question.type === 'TEXT' ? (
                    <Input
                      placeholder="Your response"
                      value={answers[survey.id]?.[question.id] ?? ''}
                      onChange={(e) => handleAnswerChange(survey.id, question.id, e.target.value)}
                    />
                  ) : question.type === 'RATING' ? (
                    <Input
                      placeholder="Rating 1-5"
                      type="number"
                      min={1}
                      max={5}
                      value={answers[survey.id]?.[question.id] ?? ''}
                      onChange={(e) =>
                        handleAnswerChange(survey.id, question.id, Number(e.target.value))
                      }
                    />
                  ) : question.type === 'MULTI_CHOICE' ? (
                    <div className="flex flex-wrap gap-3 text-sm text-muted">
                      {(question.options ?? []).map((option: string) => {
                        const current = (answers[survey.id]?.[question.id] ?? []) as string[];
                        const checked = current.includes(option);
                        return (
                          <label key={option} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...current, option]
                                  : current.filter((item) => item !== option);
                                handleAnswerChange(survey.id, question.id, next);
                              }}
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <select
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                      value={answers[survey.id]?.[question.id] ?? ''}
                      onChange={(e) => handleAnswerChange(survey.id, question.id, e.target.value)}
                    >
                      <option value="">Select</option>
                      {(question.options ?? []).map((option: string) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button
                onClick={() => {
                  if (!canSubmitSurvey) {
                    setSurveyErrors((prev) => ({
                      ...prev,
                      [survey.id]: `Complete required questions: ${missingRequiredQuestions.join(', ')}`,
                    }));
                    return;
                  }
                  setSurveyErrors((prev) => {
                    const next = { ...prev };
                    delete next[survey.id];
                    return next;
                  });
                  submitSurvey({ surveyId: survey.id, answers: answers[survey.id] ?? {} });
                }}
                disabled={!canSubmitSurvey}
              >
                Submit survey
              </Button>
              {surveyError ? (
                <p className="mt-2 text-xs text-destructive">{surveyError}</p>
              ) : null}
              {!surveyError && !canSubmitSurvey ? (
                <p className="mt-2 text-xs text-muted">
                  Required: {missingRequiredQuestions.join(', ')}
                </p>
              ) : null}
            </div>
          </Card>
        );
      })}
      {!surveys?.length ? <p className="text-sm text-muted">No active surveys.</p> : null}
    </div>
  );
}
