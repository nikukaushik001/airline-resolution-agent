import { NextResponse } from 'next/server';
import { handleCustomerMessage } from '@/lib/agent';

export async function POST(req: Request) {
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
