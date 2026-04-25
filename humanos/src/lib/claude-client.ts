/**
 * Claude API Client - Wraps the Anthropic SDK for the conversational reasoning layer.
 * 
 * Used in Phase 3. Calls the Anthropic API with the cardiometabolic-research MCP
 * server attached as a remote tool. Claude reasons over the user query, calls
 * the appropriate MCP tools, and returns a natural language response.
 * 
 * This module is server-side only. Never import it from client components.
 * Frontend components should call /api/chat which uses this internally.
 */

import Anthropic from '@anthropic-ai/sdk';
import { HUMAN_OS_SYSTEM_PROMPT, HUMAN_OS_VOICE_ADDENDUM } from './prompts';

// Verify model identifier against Anthropic docs before deploying
const MODEL = 'claude-sonnet-4-5';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? '';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  mode?: 'voice' | 'text';
}

export interface ChatResponse {
  text: string;
  toolCalls: Array<{ name: string; input: any }>;
  toolResults: Array<{ name: string; output: any }>;
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  
  const systemPrompt = req.mode === 'voice'
    ? `${HUMAN_OS_SYSTEM_PROMPT}\n\n${HUMAN_OS_VOICE_ADDENDUM}`
    : HUMAN_OS_SYSTEM_PROMPT;
  
  const requestParams: any = {
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: req.messages,
  };
  
  if (MCP_SERVER_URL) {
    requestParams.mcp_servers = [{
      type: 'url',
      url: MCP_SERVER_URL,
      name: 'cardiometabolic-research',
    }];
  }
  
  const response = await client.messages.create(requestParams);
  
  const textParts: string[] = [];
  const toolCalls: Array<{ name: string; input: any }> = [];
  const toolResults: Array<{ name: string; output: any }> = [];
  
  for (const block of response.content) {
    if (block.type === 'text') {
      textParts.push(block.text);
    } else if (block.type === 'tool_use') {
      toolCalls.push({ name: block.name, input: block.input });
    } else if ((block as any).type === 'mcp_tool_use') {
      toolCalls.push({ name: (block as any).name, input: (block as any).input });
    } else if ((block as any).type === 'mcp_tool_result') {
      const content = (block as any).content;
      const text = Array.isArray(content) ? content.map((c: any) => c.text).join('\n') : String(content);
      try {
        toolResults.push({ name: 'mcp_result', output: JSON.parse(text) });
      } catch {
        toolResults.push({ name: 'mcp_result', output: text });
      }
    }
  }
  
  return {
    text: textParts.join('\n'),
    toolCalls,
    toolResults,
  };
}
