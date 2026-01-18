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

  // Calculate summary statistics
  const totalInvoices = contextData.length;
  const totalAmount = contextData.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const byStatus = contextData.reduce((acc, inv) => {
    acc[inv.currentStage] = (acc[inv.currentStage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byEntity = contextData.reduce((acc, inv) => {
    const entity = inv.entity || 'Unassigned';
    acc[entity] = (acc[entity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byVendor = contextData.reduce((acc, inv) => {
    acc[inv.vendor] = (acc[inv.vendor] || { count: 0, amount: 0 });
    acc[inv.vendor].count += 1;
    acc[inv.vendor].amount += inv.amount || 0;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

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
    paymentBlocked: inv.paymentBlocked,
    createdBy: inv.createdBy || 'Unknown',
    createdByRole: inv.createdByRole || 'Unknown',
    daysOpen: Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    isClosed: inv.currentStage === 'Closed',
  }));

  const systemPrompt = `You are a Professional Finance Data Analyst for the FinComms Invoice Tracking System.

=== CURRENT DATA SUMMARY ===
• Total Invoices: ${totalInvoices}
• Total Value: €${totalAmount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
• By Status: ${JSON.stringify(byStatus)}
• By Entity: ${JSON.stringify(byEntity)}
• By Vendor: ${JSON.stringify(byVendor)}

=== DETAILED INVOICE DATA ===
${JSON.stringify(simplifiedContext, null, 2)}

=== RESPONSE GUIDELINES ===
Always respond in a PROFESSIONAL, STRUCTURED format using:

1. **For Data Queries (summaries, reports, analysis):**
   - Start with a brief executive summary (1-2 sentences)
   - Use bullet points (•) for all list items
   - Group information logically with clear headers
   - Format amounts as: €X,XXX.XX
   - Format invoices as: Invoice #[NUMBER] | [VENDOR] | €[AMOUNT] | Status: [STATUS]
   - Include totals and percentages where relevant
   - End with key insights or recommendations if applicable

2. **For Email Generation (when user asks for email, carta, correo, etc.):**
   - Detect language: Write in SPANISH if user mentions "español", "Spanish", "carta", "correo"
   - Write in ENGLISH by default or if user mentions "English", "email"
   - Structure emails professionally:
     * Subject line
     * Professional greeting
     * Clear purpose statement
     * Invoice details in bullet format
     * Specific request/action needed
     * Professional closing
   - For vendor requests, include: invoice numbers, amounts, dates, what documentation is needed
   - Tone: Formal, courteous, clear

3. **Email Templates Available:**
   - Missing Invoice Request (request copy of invoice from vendor)
   - PO Number Request (request PO number for invoice)
   - Payment Status Inquiry (ask about payment status)
   - Documentation Request (request supporting documents)

=== WORKFLOW CONTEXT ===
Invoice Flow: Reconciliation Team → AP Processing → Payment Queue → Closed
- MISSING_INVOICE flow: Invoice Missing → Sent to AP Processing → PO Created → Posted → Closed
- PO_PENDING flow: Invoice Received → PO Email Sent → PO Created → EXR Created → Closed`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return response.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    return `I encountered an error trying to analyze the data: ${error.message || 'Unknown error'}. Please try again.`;
  }
};