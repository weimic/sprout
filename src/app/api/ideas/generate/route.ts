import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';

function safeParseJSON<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode,
      projectContext,
      parentText,
      extraContext,
    }: {
      mode: 'initial' | 'related' | 'addtl';
      projectContext: string;
      parentText?: string;
      extraContext?: string;
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    // Build prompt
    const baseInstruction = `You are an expert brainstorming partner for rapid ideation. Generate clear, accessible, thought-provoking content optimized for quick scanning and deep exploration. Respond with STRICT JSON only.`;

    let sysGoal = '';
    if (mode === 'initial') {
      sysGoal = `Given the user's project context, return exactly three ultra-concise, immediately understandable idea statements or questions. Each should be 3-10 words maximum - crystal clear yet intriguing. Use simple language that sparks curiosity. Examples: "What if time moved backwards?", "A chef who tastes emotions", "Cities that grow like plants". Vary formats: questions, fragments, or "what if" statements. Prioritize clarity and instant comprehension while maintaining intrigue.`;
    } else if (mode === 'related') {
      sysGoal = `Given the active idea and the project context, plus optional user context, generate exactly three new branching ideas or questions. Keep each to 3-12 words maximum. Use clear, accessible language that anyone can immediately grasp, yet make them thought-provoking enough to spark deeper exploration. Examples: "What if this backfires?", "The opposite perspective", "Hidden costs nobody sees". Balance simplicity with depth - avoid jargon, embrace clarity.`;
    } else {
      sysGoal = `Given the active idea and the project context, write a concise, impactful exploration (2-4 sentences maximum) that reveals one key insight, tension, or creative direction. Be specific and generative. Focus on depth over breadth - one powerful angle is better than surface-level coverage of many. Make every word count.`;
    }

    const schemaHint = `Output format (strict JSON):\n{\n  "ideas": ["string", "string", "string"], // present for modes initial and related\n  "addtlText": "string" // present for mode addtl\n}`;

    const inputs: string[] = [
      baseInstruction,
      sysGoal,
      schemaHint,
      `Project context: ${projectContext}`,
    ];
    if (parentText) inputs.push(`Active idea: ${parentText}`);
    if (extraContext) inputs.push(`User extra context: ${extraContext}`);

    const prompt = inputs.join('\n\n');

    const resp = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const text = resp.response.text();

    // Try parse JSON strictly; if the model wrapped code fences, strip them
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = safeParseJSON<{ ideas?: string[]; addtlText?: string }>(cleaned) ?? safeParseJSON(text);

    if (!parsed) {
      return NextResponse.json({ error: 'Model did not return valid JSON', raw: text }, { status: 502 });
    }

    // Sanitize outputs
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.filter((s) => typeof s === 'string').slice(0, 3) : undefined;
    const addtlText = typeof parsed.addtlText === 'string' ? parsed.addtlText : undefined;

    return NextResponse.json({ ideas, addtlText });
  } catch (e) {
    console.error('Generation error', e);
    return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
  }
}
