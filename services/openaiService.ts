import OpenAI from 'openai';
import { Invoice, FlowStage, FlowType } from '../types';

// Build compound filters that accumulate instead of returning early
const filterInvoicesForQuery = (query: string, invoices: Invoice[]): Invoice[] => {
  const lowerQuery = query.toLowerCase();

  // Build an array of filter functions to apply together
  const filters: ((inv: Invoice) => boolean)[] = [];

  // === STATUS FILTERS (mutually exclusive - pick one) ===
  // "Missing PO" or "PO Pending" - invoices waiting for PO creation (NOT CLOSED!)
  if (lowerQuery.includes('missing po') || lowerQuery.includes('po pending') ||
      lowerQuery.includes('create po') || lowerQuery.includes('po creation') ||
      lowerQuery.includes('request po') || lowerQuery.includes('awaiting po') ||
      lowerQuery.includes('falta po') || lowerQuery.includes('crear po') ||
      lowerQuery.includes('pendiente po') || lowerQuery.includes('necesita po')) {
    filters.push(inv =>
      inv.currentStage === FlowStage.MISSING_INVOICE_PO_PENDING ||
      inv.currentStage === FlowStage.PO_PENDING_RECEIVED ||
      inv.currentStage === FlowStage.PO_PENDING_PO_EMAIL_SENT
    );
  }
  // "Invoice Missing" - initial stage
  else if (lowerQuery.includes('invoice missing') || lowerQuery.includes('factura faltante') ||
           lowerQuery.includes('factura perdida')) {
    filters.push(inv => inv.currentStage === FlowStage.MISSING_INVOICE_MISSING);
  }
  // "Sent to Vendor"
  else if (lowerQuery.includes('sent to vendor') || lowerQuery.includes('vendor request') ||
           lowerQuery.includes('enviado al proveedor') || lowerQuery.includes('solicitud proveedor')) {
    filters.push(inv => inv.currentStage === FlowStage.MISSING_INVOICE_SENT_TO_VENDOR);
  }
  // "Sent to AP"
  else if (lowerQuery.includes('sent to ap') || lowerQuery.includes('ap processing') ||
           lowerQuery.includes('enviado a ap') || lowerQuery.includes('procesamiento ap')) {
    filters.push(inv => inv.currentStage === FlowStage.MISSING_INVOICE_SENT_TO_AP);
  }
  // "Posted"
  else if ((lowerQuery.includes('posted') || lowerQuery.includes('publicado') ||
            lowerQuery.includes('registrado')) && !lowerQuery.includes('closed')) {
    filters.push(inv => inv.currentStage === FlowStage.MISSING_INVOICE_POSTED);
  }
  // "Closed" - only if explicitly requested
  else if (lowerQuery.includes('closed') || lowerQuery.includes('completed') ||
           lowerQuery.includes('cerrado') || lowerQuery.includes('completado') ||
           lowerQuery.includes('finalizado')) {
    filters.push(inv => inv.currentStage === FlowStage.CLOSED);
  }
  // Payment status
  else if ((lowerQuery.includes('payment') || lowerQuery.includes('pago')) &&
           (lowerQuery.includes('pending') || lowerQuery.includes('requested') ||
            lowerQuery.includes('pendiente') || lowerQuery.includes('solicitado'))) {
    filters.push(inv => inv.paymentStatus === 'REQUESTED');
  }
  // Blocked
  else if (lowerQuery.includes('blocked') || lowerQuery.includes('bloqueado')) {
    filters.push(inv => inv.paymentBlocked === true);
  }

  // === PO OWNER FILTER (can combine with status) ===
  const poOwnerMatch = lowerQuery.match(/po\s*owner\s+(\w+)/i) ||
                       lowerQuery.match(/assigned\s+to\s+(\w+)/i) ||
                       lowerQuery.match(/owner\s+(\w+)/i) ||
                       lowerQuery.match(/propietario\s+(\w+)/i) ||
                       lowerQuery.match(/asignado\s+a\s+(\w+)/i) ||
                       lowerQuery.match(/dueño\s+(\w+)/i);
  if (poOwnerMatch) {
    const poOwner = poOwnerMatch[1].toUpperCase();
    filters.push(inv => inv.poCreator?.toUpperCase().includes(poOwner));
  }

  // === ENTITY FILTER (can combine) ===
  const entityMatch = lowerQuery.match(/entity\s+(\w+)/i) ||
                      lowerQuery.match(/for\s+(ipp|ian|other)\b/i) ||
                      lowerQuery.match(/entidad\s+(\w+)/i) ||
                      lowerQuery.match(/para\s+(ipp|ian|other)\b/i);
  if (entityMatch) {
    const entity = entityMatch[1].toUpperCase();
    filters.push(inv => inv.entity?.toUpperCase() === entity);
  }

  // === INVOICE NUMBER FILTER (can combine) ===
  const invoiceMatch = lowerQuery.match(/inv\s*#?\s*(\d+)/i) ||
                       lowerQuery.match(/invoice\s*#?\s*(\d+)/i) ||
                       lowerQuery.match(/factura\s*#?\s*(\d+)/i) ||
                       lowerQuery.match(/(\d{5,})/);
  if (invoiceMatch) {
    const invNum = invoiceMatch[1];
    filters.push(inv => inv.invoiceNumber.includes(invNum));
  }

  // === FLOW TYPE FILTER (can combine) ===
  if (lowerQuery.includes('direct entr') || lowerQuery.includes('manual entr') ||
      lowerQuery.includes('entrada directa') || lowerQuery.includes('entrada manual')) {
    filters.push(inv => inv.flowType === FlowType.PO_PENDING);
  }
  if (lowerQuery.includes('reconciliation') || lowerQuery.includes('recon') ||
      lowerQuery.includes('reconciliación') || lowerQuery.includes('conciliación')) {
    filters.push(inv => inv.flowType === FlowType.MISSING_INVOICE);
  }

  // === VENDOR FILTER (only if explicitly mentioned) ===
  const vendorMatch = lowerQuery.match(/vendor\s+(\w+)/i) ||
                      lowerQuery.match(/proveedor\s+(\w+)/i) ||
                      lowerQuery.match(/supplier\s+(\w+)/i);
  if (vendorMatch) {
    const vendorName = vendorMatch[1].toLowerCase();
    filters.push(inv => inv.vendor.toLowerCase().includes(vendorName));
  }

  // Apply all filters together (AND logic)
  if (filters.length === 0) {
    return invoices;
  }

  return invoices.filter(inv => filters.every(filterFn => filterFn(inv)));
};

// Determine the type of request and detect language
const getQueryType = (query: string): 'email' | 'report' | 'question' | 'action' => {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('email') || lowerQuery.includes('write') || lowerQuery.includes('draft') ||
      lowerQuery.includes('correo') || lowerQuery.includes('carta') || lowerQuery.includes('escribe') ||
      lowerQuery.includes('redacta') || lowerQuery.includes('enviar') || lowerQuery.includes('mensaje')) {
    return 'email';
  }

  if (lowerQuery.includes('report') || lowerQuery.includes('summary') || lowerQuery.includes('overview') ||
      lowerQuery.includes('list') || lowerQuery.includes('show') ||
      lowerQuery.includes('informe') || lowerQuery.includes('resumen') || lowerQuery.includes('mostrar') ||
      lowerQuery.includes('listar')) {
    return 'report';
  }

  if (lowerQuery.includes('how') || lowerQuery.includes('what') || lowerQuery.includes('why') ||
      lowerQuery.includes('when') || lowerQuery.includes('?') ||
      lowerQuery.includes('cómo') || lowerQuery.includes('qué') || lowerQuery.includes('por qué') ||
      lowerQuery.includes('cuándo') || lowerQuery.includes('cuál')) {
    return 'question';
  }

  return 'action';
};

// Detect language preference
const detectLanguage = (query: string): 'es' | 'en' => {
  const lowerQuery = query.toLowerCase();
  const spanishKeywords = [
    'español', 'correo', 'carta', 'escribe', 'redacta', 'enviar', 'mensaje',
    'factura', 'proveedor', 'pendiente', 'cerrado', 'informe', 'resumen',
    'por favor', 'gracias', 'urgente', 'necesito', 'crear', 'solicitar',
    'hola', 'buenos días', 'estimado', 'atentamente', 'saludos'
  ];

  for (const keyword of spanishKeywords) {
    if (lowerQuery.includes(keyword)) {
      return 'es';
    }
  }

  return 'en';
};

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

  // Pre-filter invoices based on query
  const filteredData = filterInvoicesForQuery(question, contextData);
  const queryType = getQueryType(question);
  const language = detectLanguage(question);

  // Calculate summary statistics for filtered data
  const totalInvoices = filteredData.length;
  const totalAmount = filteredData.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const byStatus = filteredData.reduce((acc, inv) => {
    acc[inv.currentStage] = (acc[inv.currentStage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byPOOwner = filteredData.reduce((acc, inv) => {
    const owner = inv.poCreator || 'Unassigned';
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push({
      invoice: inv.invoiceNumber,
      vendor: inv.vendor,
      amount: inv.amount || 0,
      status: inv.currentStage
    });
    return acc;
  }, {} as Record<string, any[]>);

  // Create a simplified context focused on what matters
  const simplifiedContext = filteredData.map(inv => ({
    invoice: inv.invoiceNumber,
    vendor: inv.vendor,
    amount: inv.amount || 0,
    currency: inv.currency || 'EUR',
    entity: inv.entity || 'Unassigned',
    poCreator: inv.poCreator || 'Unassigned',
    status: inv.currentStage,
    flow: inv.flowType,
    statusDetail: inv.statusDetail,
    daysOpen: Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  // Group invoices by PO Owner for email context
  const invoicesByPOOwner = Object.entries(byPOOwner).map(([owner, invs]) => ({
    poOwner: owner,
    invoiceCount: invs.length,
    totalAmount: invs.reduce((sum, i) => sum + i.amount, 0),
    invoices: invs
  }));

  const systemPrompt = `You are a Professional Bilingual Finance Data Analyst for FinComms Invoice Tracking System.
You are FULLY FLUENT in both English and Spanish. Respond in the same language as the user's query.

=== DETECTED LANGUAGE: ${language === 'es' ? 'SPANISH (Respond in Spanish)' : 'ENGLISH (Respond in English)'} ===

=== CRITICAL: YOU ARE WORKING WITH PRE-FILTERED DATA ===
The data below has ALREADY been filtered based on the user's request.
There are ${totalInvoices} invoices totaling €${totalAmount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}

${totalInvoices === 0 ? `
⚠️ NO INVOICES FOUND matching the criteria!
${language === 'es' ? 'Informa al usuario que no hay facturas que coincidan con su solicitud.' : 'Inform the user that no invoices match their request.'}
` : ''}

=== FILTERED INVOICE DATA ===
${JSON.stringify(simplifiedContext, null, 2)}

=== GROUPED BY PO OWNER ===
${JSON.stringify(invoicesByPOOwner, null, 2)}

=== STATUS BREAKDOWN ===
${JSON.stringify(byStatus, null, 2)}

=== WORKFLOW STAGES ===
**Reconciliation Flow (MISSING_INVOICE):**
1. Invoice Missing → 2. Sent to Vendor → 3. Sent to AP Processing → 4. PO Pending → 5. Posted → 6. Closed

**Direct Entry Flow (PO_PENDING):**
1. Invoice Received → 2. PO Email Sent → 3. PO Created → 4. EXR Created → 5. Closed

=== ACTION REQUIRED BY STATUS ===
- "Invoice Missing" / "MISSING_INVOICE_MISSING" → Need to request invoice copy from vendor
- "Sent to Vendor" / "MISSING_INVOICE_SENT_TO_VENDOR" → Waiting for vendor response
- "PO Pending" / "MISSING_INVOICE_PO_PENDING" → **PO OWNER NEEDS TO CREATE THE PO** (URGENT!)
- "Posted" / "MISSING_INVOICE_POSTED" → Posted to system, waiting for payment
- "Invoice Received" / "PO_PENDING_RECEIVED" → Need to send PO email
- "PO Email Sent" / "PO_PENDING_PO_EMAIL_SENT" → Waiting for PO creation (URGENT!)
- "CLOSED" → Fully processed, no action needed

=== RESPONSE RULES ===

**Query Type Detected: ${queryType.toUpperCase()}**

${queryType === 'email' ? `
**EMAIL FORMAT - MUST FOLLOW:**
1. Start with [EMAIL] marker
2. Include clear Subject line (${language === 'es' ? 'Asunto:' : 'Subject:'})
3. Be professional but direct
4. ALWAYS list the specific invoices from the data above
5. Use bullet points for invoice details
6. Format: ${language === 'es' ? 'Factura' : 'Invoice'} #[NUMBER] | [VENDOR] | €[AMOUNT]
7. Include urgency if PO Pending (these need immediate action)
8. ${language === 'es' ? 'Responde COMPLETAMENTE en español' : 'Respond COMPLETELY in English'}

**FOR PO CREATION EMAILS specifically:**
- Address to the PO Owner(s) listed in the data
- State these invoices are AWAITING PO CREATION
- Request URGENT action
- List ONLY the invoices that actually need PO creation (NOT closed ones!)

**${language === 'es' ? 'EJEMPLO DE FORMATO EN ESPAÑOL:' : 'EXAMPLE FORMAT:'}**
[EMAIL]
${language === 'es' ? 'Asunto: Solicitud Urgente - Creación de PO Pendiente' : 'Subject: Urgent Request - PO Creation Pending'}

${language === 'es' ? 'Estimado/a [NOMBRE],' : 'Dear [NAME],'}

${language === 'es' ? 'Las siguientes facturas requieren creación urgente de PO:' : 'The following invoices require urgent PO creation:'}

• ${language === 'es' ? 'Factura' : 'Invoice'} #[NUMBER] | [VENDOR] | €[AMOUNT]

${language === 'es' ? 'Por favor, tome acción inmediata.' : 'Please take immediate action.'}

${language === 'es' ? 'Saludos cordiales,' : 'Best regards,'}
[Your Name]
` : ''}

${queryType === 'report' ? `
**REPORT FORMAT:**
- Start with brief summary
- Use bullet points (•)
- Group by relevant criteria (status/vendor/PO owner)
- Include totals
- ${language === 'es' ? 'Responde en español' : 'Respond in English'}
` : ''}

=== IMPORTANT ===
- ONLY use the filtered data provided above - it's already filtered for this query
- If no invoices match, say "${language === 'es' ? 'No se encontraron facturas que coincidan con su criterio' : 'No invoices found matching your criteria'}"
- Be specific with invoice numbers, amounts, and vendors
- For emails, ALWAYS include the actual invoice data in bullet points
- NEVER include CLOSED invoices in emails requesting PO creation - they are already done!
- Respond in ${language === 'es' ? 'SPANISH' : 'ENGLISH'} as detected from the user query`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.4, // Lower temperature for more consistent output
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    return `I encountered an error trying to analyze the data: ${error.message || 'Unknown error'}. Please try again.`;
  }
};
