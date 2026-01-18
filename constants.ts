
import { FlowStage, FlowType, Invoice } from './types';

export const TEAM_STAGES = {
  RECON: [
    FlowStage.MISSING_INVOICE_MISSING,
    FlowStage.MISSING_INVOICE_SENT_TO_VENDOR,
    FlowStage.MISSING_INVOICE_POSTED
  ],
  AP: [
    FlowStage.MISSING_INVOICE_SENT_TO_AP,
    FlowStage.PO_PENDING_RECEIVED,
    FlowStage.PO_PENDING_SENT,
    FlowStage.PO_PENDING_CREATED,
    FlowStage.PO_PENDING_EXR_CREATED
  ],
  PAYMENT: [
    FlowStage.CLOSED
  ]
};

export const getStageOwner = (stage: FlowStage): string => {
  if (TEAM_STAGES.RECON.includes(stage)) return 'Reconciliation Team';
  if (TEAM_STAGES.AP.includes(stage)) return 'AP Processing Team';
  if (stage === FlowStage.CLOSED) return 'Reconciliation / Payment';
  return 'Unknown';
};

export const FLOW_CONFIG: Record<FlowType, FlowStage[]> = {
  [FlowType.MISSING_INVOICE]: [
    FlowStage.MISSING_INVOICE_MISSING,
    FlowStage.MISSING_INVOICE_SENT_TO_AP,
    FlowStage.PO_PENDING_CREATED,
    FlowStage.MISSING_INVOICE_POSTED,
    FlowStage.CLOSED
  ],
  [FlowType.PO_PENDING]: [
    FlowStage.PO_PENDING_RECEIVED,
    FlowStage.PO_PENDING_SENT,
    FlowStage.PO_PENDING_CREATED,
    FlowStage.PO_PENDING_EXR_CREATED,
    FlowStage.CLOSED
  ]
};

export const MOCK_INVOICES: Invoice[] = [];
