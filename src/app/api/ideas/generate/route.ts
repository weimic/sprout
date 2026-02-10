import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';

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
    const baseInstruction = `You are an expert Ideation Facilitator, capable of two distinct modes: Generator: For users who need new ideas from scratch. Provocateur: For users who have an existing idea to challenge. Your job is to analyze the user's request, deploy the correct mode, and generate content that is clear, accessible, and concise. Respond with STRICT JSON only.`;

    let sysGoal = '';
    if (mode === 'initial') {
      sysGoal = `First, analyze the user's input to determine their primary intent: If Intent = GENERATE (user is lost, asks for 'ideas', 'inspiration', or 'where to start'): Return exactly three creative, ultra-concise idea starters. Use simple, evocative language to spark new concepts. Examples: "A library of lost sounds," "What if plants could vote?", "Rebellion as an art form." If Intent = PROVOKE (user provides a specific idea, project, or context): Return exactly three provocative questions or statements. Challenge their core assumptions, uncover blind spots, or force a new perspective. Examples: "Who does this exclude?", "What if it works too well?", "The opposite is also true." Each item must be 3-15 words maximum. The goal is instant comprehension paired with deep reflection.`;
    } else if (mode === 'related') {
      sysGoal = `Given the active idea/provocation and the original project context, continue the established mode: If the active item is an IDEA STARTER: Generate three new branching ideas that build upon, twist, or are adjacent to the original concept. If the active item is a PROVOCATION: Generate three new follow-up provocations that escalate the challenge, introduce a constraint, or explore a consequence. Keep each to 3-15 words maximum. Be direct, clear, and maintain the creative (Generator) or challenging (Provocateur) tone.`;
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
