import { NextResponse } from 'next/server';
import { handleCustomerMessage } from '@/lib/agent';

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY environment variable is not set in production.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { pnr, message, history = [] } = body;

    if (!pnr || !message) {
      return NextResponse.json({ error: 'PNR and message are required' }, { status: 400 });
    }

    const response = await handleCustomerMessage(pnr, message, history);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
