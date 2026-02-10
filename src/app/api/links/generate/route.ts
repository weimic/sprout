import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use gemini-1.5-flash or gemini-pro as fallback
// gemini-2.0-flash may not be available in all regions yet
const MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash-lite';

/**
 * API Route: Generate Useful External Links
 * 
 * Leverages Gemini AI to curate high-quality, authoritative external resources
 * related to the user's canvas topic. The AI is prompted to act as an elite
 * research assistant, applying strict quality criteria to ensure only the most
 * valuable, credible sources are returned.
 * 
 * Quality Criteria:
 * - Authority: Academic, industry-leading, peer-reviewed sources
 * - Depth: Substantial, well-researched content
 * - Recency: Current resources preferred (unless historical/foundational)
 * - Accessibility: Comprehensible and actionable
 * - Diversity: Varied resource types (papers, docs, tutorials, case studies)
 * 
 * @route POST /api/links/generate
 * @body {
 *   projectContext: string - Main topic/context of the canvas
 *   activeIdea?: string - Currently active idea to focus search (optional)
 *   count?: number - Number of links to generate (default: 5)
 * }
 * @returns {
 *   links: Array<{ title: string, url: string, snippet: string }>
 *   count: number
 * }
 * @errors 400, 500, 502
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectContext,
      activeIdea,
      count = 5,
    }: {
      projectContext: string;
      activeIdea?: string;
      count?: number;
    } = body;

    // Validation
    if (!projectContext?.trim()) {
      return NextResponse.json(
        { error: 'projectContext is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log('Using Gemini model:', MODEL);
    console.log('API key configured:', apiKey ? 'Yes' : 'No');

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use model with grounding configuration for web search
    const model = genAI.getGenerativeModel({
      model: MODEL,
    });

    // Construct contextual search query
    const searchContext = activeIdea 
      ? `${projectContext} - focusing on: ${activeIdea}`
      : projectContext;
    
    console.log('Generating content for context:', searchContext.substring(0, 100));

    const prompt = `You are an elite research assistant with expertise in information curation and quality assessment. Your mission is to find the most valuable, authoritative external resources on a given topic.

TOPIC: "${searchContext}"

TASK: Identify exactly ${count} exceptional web resources that would genuinely advance someone's understanding of this topic. Each resource must meet high standards for credibility, depth, and practical value.

SELECTION CRITERIA (in priority order):
1. **Authority**: Academic institutions, industry leaders, peer-reviewed sources, official documentation
2. **Depth**: Substantial, well-researched content that goes beyond surface-level information
3. **Recency**: Prefer current resources unless the topic requires foundational/historical content
4. **Accessibility**: Content should be comprehensible and actionable for the target audience
5. **Diversity**: Vary resource types (research papers, technical docs, tutorials, case studies, tools)

AVOID:
- Listicles or "top 10" style articles
- Overly promotional or marketing-focused content
- Paywalled content without substantial free previews
- Low-quality blog posts or opinion pieces
- Duplicate or highly similar perspectives

FOR EACH RESOURCE, PROVIDE:
1. **title**: Clear, descriptive title that captures the resource's value (5-12 words)
2. **url**: Direct, working URL to the resource
3. **snippet**: Compelling 1-2 sentence explanation of why this resource is uniquely valuable and what the reader will gain from it

OUTPUT FORMAT (strict JSON, no markdown):
{
  "links": [
    {
      "title": "Precise, informative resource title",
      "url": "https://authoritative-source.com/path",
      "snippet": "Explains exactly what makes this resource valuable and what insights it provides."
    }
  ]
}

Generate ${count} high-quality links now:`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = result.response.text();
    
    // Parse the JSON response
    let parsedResponse;
    try {
      // Try direct parse first
      parsedResponse = JSON.parse(responseText);
    } catch {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        // Last resort: try to find JSON object in the response
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          parsedResponse = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }
    }

    // Validate response structure
    if (!parsedResponse?.links || !Array.isArray(parsedResponse.links)) {
      return NextResponse.json(
        { error: 'Invalid response format from AI', raw: responseText },
        { status: 502 }
      );
    }

    // Validate and sanitize each link
    const validLinks = parsedResponse.links
      .filter((link: unknown) => {
        if (typeof link !== 'object' || link === null) return false;
        const l = link as Record<string, unknown>;
        return (
          typeof l.title === 'string' &&
          typeof l.url === 'string' &&
          typeof l.snippet === 'string' &&
          l.title.trim().length > 0 &&
          l.url.trim().length > 0 &&
          (l.url.startsWith('http://') || l.url.startsWith('https://'))
        );
      })
      .map((link: unknown) => {
        const l = link as { title: string; url: string; snippet: string };
        return {
          title: l.title.trim(),
          url: l.url.trim(),
          snippet: l.snippet.trim(),
        };
      })
      .slice(0, count); // Ensure we don't exceed requested count

    if (validLinks.length === 0) {
      return NextResponse.json(
        { error: 'No valid links generated', raw: responseText },
        { status: 502 }
      );
    }

    return NextResponse.json({
      links: validLinks,
      count: validLinks.length,
    });

  } catch (error) {
    console.error('Link generation error:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      {
        error: 'Failed to generate links',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.name : 'UnknownError',
      },
      { status: 500 }
    );
  }
}
