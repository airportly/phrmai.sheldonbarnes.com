import type { NextApiRequest, NextApiResponse } from 'next';
import { chat } from '@/lib/claude-client';

/**
 * /api/chat - Backend route for the Claude reasoning layer.
 * 
 * Accepts the conversation history and optional voice mode flag.
 * Calls Claude with the cardiometabolic-research MCP server attached.
 * Returns the natural language response plus tool call metadata so the
 * frontend can update the interface state (e.g., populate cards when Claude
 * looks up a specific protein).
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { messages, mode } = req.body;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    
    const response = await chat({ messages, mode });
    return res.status(200).json(response);
    
  } catch (error: any) {
    console.error('[chat] error:', error);
    return res.status(500).json({
      error: 'Chat service unavailable',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
