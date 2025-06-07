import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return json({ error: "API key is required" }, { status: 400 });
    }

    // Test the OpenAI API key with a simple request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Say "Connection successful" if you can read this.'
          }
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return json({ 
        error: `OpenAI API Error: ${errorData.error?.message || response.statusText}` 
      }, { status: response.status });
    }

    const data = await response.json();
    return json({ 
      success: true, 
      message: data.choices[0]?.message?.content || "Connection successful"
    });

  } catch (error) {
    console.error('OpenAI test error:', error);
    return json({ 
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
};