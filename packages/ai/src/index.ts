import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface GenerateTextInput {
  provider: AIProvider;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generateTextSimple(input: GenerateTextInput) {
  const model =
    input.provider === 'openai'
      ? openai(input.model)
      : input.provider === 'anthropic'
      ? anthropic(input.model)
      : google(input.model);

  const { text } = await generateText({
    model,
    prompt: input.prompt,
    temperature: input.temperature ?? 0.2,
  });

  return text;
}
