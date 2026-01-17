import React from 'react';
import { clsx } from 'clsx';
import { FlowStage } from '../../types';

interface BadgeProps {
  stage: FlowStage;
  className?: string;
}

const getBadgeStyle = (stage: FlowStage) => {
  if (stage === FlowStage.CLOSED) return 'bg-gray-800 text-gray-300 border-gray-700';
  
  if (stage === FlowStage.MISSING_INVOICE_MISSING) return 'bg-red-900/30 text-red-400 border-red-900/50';
  if (stage === FlowStage.MISSING_INVOICE_SENT_TO_AP) return 'bg-purple-900/30 text-purple-400 border-purple-900/50';
  if (stage === FlowStage.PO_PENDING_SENT) return 'bg-purple-900/30 text-purple-400 border-purple-900/50';
  
  // Combined check for Reconciled stage in both flows.
  if (stage === FlowStage.MISSING_INVOICE_RECONCILED) {
    return 'bg-teal-900/30 text-teal-400 border-teal-900/50';
  }
  
  if (stage.includes('Received')) return 'bg-blue-900/30 text-blue-400 border-blue-900/50';
  if (stage.includes('Pending')) return 'bg-orange-900/30 text-orange-400 border-orange-900/50';
  if (stage.includes('Created')) return 'bg-indigo-900/30 text-indigo-400 border-indigo-900/50';
  if (stage.includes('Posted')) return 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50';
  
  return 'bg-slate-800 text-slate-300';
};

export const Badge: React.FC<BadgeProps> = ({ stage, className }) => {
  // Display "PO Pending" instead of "PO Created"
  const displayText = stage === FlowStage.PO_PENDING_CREATED ? 'PO Pending' : stage;

  return (
    <span className={clsx(
      'inline-block px-2.5 py-1 rounded-full text-xs font-medium border text-center leading-normal whitespace-normal',
      getBadgeStyle(stage),
      className
    )}>
      {displayText}
    </span>
  );
};