# Claude API Integration

This document specifies how the Claude API is integrated into Human OS for the conversational reasoning layer. The Claude integration is the layer that turns voice queries into grounded responses by calling the cardiometabolic-research MCP server and synthesizing the results.

## Architecture

```
User voice → Web Speech API → text transcript
                                    ↓
                             Next.js API route
                                    ↓
                  Anthropic SDK with MCP server attached
                                    ↓
              Claude reasons, calls MCP tools, gets data
                                    ↓
                    Claude synthesizes natural response
                                    ↓
                           Text response to client
                                    ↓
              SpeechSynthesis API speaks it aloud
                  AND chat panel displays it
                  AND interface state updates
```

## SDK and model

Use the official Anthropic SDK for TypeScript: `@anthropic-ai/sdk`. The integration happens server-side in a Next.js API route, never in the browser, so the API key stays secret.

Use Claude Sonnet or Opus depending on cost and latency requirements. For the Human OS use case, Sonnet is a reasonable default; it has strong reasoning and tool use, faster response times than Opus, and lower cost per query.

Verify current model identifiers in Anthropic's documentation before deploying. Model strings change.

## MCP server attachment

The Anthropic API supports attaching MCP servers as remote tools. The cardiometabolic-research server is the relevant one. Configuration:

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5", // verify current model ID
  max_tokens: 1024,
  system: HUMAN_OS_SYSTEM_PROMPT,
  messages: conversationHistory,
  mcp_servers: [
    {
      type: "url",
      url: process.env.MCP_SERVER_URL,
      name: "cardiometabolic-research"
    }
  ]
});
```

The MCP server URL depends on deployment. For development, this is the local server. For production, this is the internal PhrmAI deployment.

## System prompt

The system prompt establishes the Human OS persona and constrains responses to grounded data. The full prompt lives in `src/lib/prompts.ts`. Key elements:

```
You are Human OS, the conversational interface for a clinical AI platform 
focused on cardiometabolic disease drug discovery. You have access to the 
cardiometabolic-research MCP server, which contains curated data for 13 
diseases: diabetes mellitus, obesity, metabolic syndrome, NAFLD, coronary 
artery disease, MI, heart failure, hypertension, dyslipidemia, atherosclerosis, 
atrial fibrillation, stroke, and familial hypercholesterolemia.

When the user asks about a protein, organ, or disease, use the MCP tools to 
retrieve grounded data. Never recall protein details from training data. 
Always check the database.

Available MCP tools:
- search_proteins_by_disease: find proteins associated with a disease
- get_protein_details: retrieve full record for one protein
- get_pathogenic_variants: pathogenic AlphaMissense variants for a protein
- search_similar_proteins_semantic: find functionally similar proteins

Response format:
- Conversational tone, not bulleted lists, not academic
- Mention specific values (pLDDT, association scores, variant counts) when relevant
- If a query is outside the 13-disease scope, say so clearly
- If the database is unavailable, say that, don't substitute training-time recall
- Keep responses under 4 sentences for voice synthesis. The user is going to 
  hear this aloud.

Tone: Confident, clinical, helpful. Like a senior research scientist who knows 
the database intimately and respects the user's time.

Never refuse to help. If a query is outside scope, redirect to what the database 
does cover. If you don't know, say what you would need to find out.
```

## Response handling

The Claude response will contain a mix of content blocks: text blocks with the natural language response, tool_use blocks showing which MCP tools were called, and tool_result blocks containing the raw MCP responses.

The Human OS frontend should:
1. Extract text blocks and display them in the chat panel
2. Speak the text via SpeechSynthesis API
3. Parse tool_result blocks to update the interface state. If Claude called `get_protein_details` for PCSK9, the frontend should populate the cards with PCSK9 data.

```typescript
const textResponse = response.content
  .filter(block => block.type === "text")
  .map(block => block.text)
  .join("\n");

const toolCalls = response.content
  .filter(block => block.type === "tool_use");

const toolResults = response.content
  .filter(block => block.type === "tool_result")
  .map(block => parseToolResult(block));

// Update UI based on which tools were called and what they returned
if (toolCalls.some(t => t.name === "get_protein_details")) {
  const proteinData = toolResults.find(r => r.toolName === "get_protein_details");
  updateContextCards(proteinData);
}
```

## Conversation state

Voice queries should maintain conversation context. If the user says "tell me about PCSK9" and then "what's its top variant?", Claude needs to remember PCSK9 from the previous turn.

Implementation: Maintain a `messages` array on the client, append each user query and assistant response, and send the full history with each new query. Cap history at 20 turns to manage token costs; older turns can be summarized into a single context message.

## Streaming

For better UX, use streaming responses. The user starts seeing words appear within 500ms instead of waiting 3 seconds for a full response. Streaming is supported by the Anthropic SDK via `messages.stream()`.

The SpeechSynthesis API does not handle streaming natively. Workaround: collect the streamed text into sentence chunks, speak each sentence as it completes. This sounds natural and matches how a human would read a response aloud.

## Error handling

Claude API can fail for several reasons: rate limits, network issues, invalid API key, MCP server unreachable. The Human OS should:

- For rate limits: queue the request and retry with exponential backoff. Show a "thinking..." state in the UI.
- For network issues: show "connection issue, please try again" and keep the conversation history.
- For invalid API key: show a config error in development, fail silently in production with a generic "service unavailable" message.
- For MCP unreachable: Claude can still respond using its general knowledge, but the response will not be grounded. The system prompt instructs Claude to say "the database is unavailable, here is what I can tell you generally" rather than pretending to have grounded data.

## Cost estimation

Per query, expect:
- Input tokens: 500 to 2,000 (system prompt + conversation history + user query)
- Output tokens: 100 to 400 (response)
- MCP tool calls: typically 1 to 3 per query, each adding 200 to 1,000 tokens

Rough estimate: 2,000 to 5,000 tokens per query at Sonnet pricing. For 100 queries per day across all users, daily cost is in the range of $1 to $5. Negligible for an internal PhrmAI tool, but worth budgeting if the Human OS scales to many users.

## Privacy and compliance

For a PhrmAI internal tool handling cardiometabolic disease data:
- Do not log full Claude API request/response content with user-identifiable information. Log timestamps, query length, and tool calls used, but not the queries themselves unless explicit user consent.
- The API calls happen server-side. The browser never sees the API key.
- If patient-specific data ever flows through this interface (it does not in v1, but might in future), the deployment must comply with applicable HIPAA and GxP standards. Consult with the compliance team before adding patient data.

## Voice-specific tuning

Voice responses are different from text responses. They must be:
- Shorter (3-4 sentences max for any single response)
- Pronounceable (avoid abbreviations the speech synthesis might mangle, like "VLDL" - say "very low density lipoprotein")
- Naturally paced (use commas and periods to control pacing)
- Free of formatting (no markdown, no parentheticals, no asterisks)

The system prompt should remind Claude of these constraints when the request specifies voice mode. Implementation: add a `mode: "voice" | "text"` field to the request and adjust the system prompt accordingly.

## Future: agentic workflows

In v2 or beyond, Human OS could support multi-step agentic workflows:
- "Find me three shadow proteins for diabetes that have AlphaFold structures above pLDDT 80, and tell me which one has the highest variant burden."

This requires Claude to plan a multi-step query, execute it, and synthesize results. The current Anthropic API supports this with extended `max_tokens` and tool use loops. Plan for it in the architecture but do not build it in v1.
