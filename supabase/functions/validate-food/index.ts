/**
 * Supabase Edge Function: validate-food
 *
 * Accepts a base64-encoded image and uses Claude to decide whether it shows
 * food. Returns { isFood: boolean, reason: string }.
 *
 * Setup (one-time):
 *   1. supabase login
 *   2. supabase link --project-ref <your-project-ref>
 *   3. supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   4. supabase functions deploy validate-food
 *
 * The SUPABASE_URL / SUPABASE_ANON_KEY env vars are injected automatically.
 */

import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 and mimeType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const client = new Anthropic()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Does this image show food, a drink, a dish, an ingredient, or a meal? Reply with exactly "yes" or "no", nothing else.',
            },
          ],
        },
      ],
    })

    const answer = (response.content[0] as { text: string }).text.trim().toLowerCase()
    const isFood = answer.startsWith('yes')

    return new Response(JSON.stringify({ isFood }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('validate-food error:', err)
    // On error, allow the upload rather than blocking the user
    return new Response(JSON.stringify({ isFood: true, error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
