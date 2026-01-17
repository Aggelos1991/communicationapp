import OpenAI from 'openai';
import { Invoice } from '../types';

export const askAssistant = async (question: string, contextData: Invoice[]) => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OpenAI API Key missing");
    return "I'm sorry, but I can't access my brain right now (API Key missing).";
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });

  const simplifiedContext = contextData.map(inv => ({
    invoice: inv.invoiceNumber,
    vendor: inv.vendor,
    amount: inv.amount || 0,
    currency: inv.currency || 'EUR',
    entity: inv.entity || 'Unassigned',
    poCreator: inv.poCreator || 'None',
    status: inv.currentStage,
    flow: inv.flowType,
    source: inv.source,
    paymentStatus: inv.paymentStatus,
    createdBy: inv.createdBy || 'Unknown',
    createdByRole: inv.createdByRole || 'Unknown',
    daysOpen: Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    isClosed: inv.currentStage === 'Closed',
  }));

  const systemPrompt = `You are a Finance Data Analyst for the FinComms App.

Current invoice data: ${JSON.stringify(simplifiedContext, null, 2)}

Response Guidelines:
- Be concise and direct - answer only what was asked
- Use bullet points for all data presentation
- Format: • Invoice [number] - [vendor] - €[amount] - [status]
- No unnecessary headers or sections
- Professional business tone
- Workflow: Reconciliation → AP Processing → Payment`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    return `I encountered an error trying to analyze the data: ${error.message || 'Unknown error'}. Please try again.`;
  }
};