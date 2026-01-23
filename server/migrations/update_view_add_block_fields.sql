-- Migration: Add block_reason and block_attachment to invoices_with_metadata view
-- Run this to update the view so it returns block fields

DROP VIEW IF EXISTS invoices_with_metadata;

CREATE VIEW invoices_with_metadata AS
SELECT
  i.id,
  i.invoice_number,
  i.vendor,
  i.amount,
  i.currency,
  i.entity,
  i.po_creator,
  i.sharepoint_url,
  i.flow_type,
  i.current_stage,
  i.source,
  i.status_detail,
  i.submission_timestamp,
  i.payment_status,
  i.payment_blocked,
  i.block_reason,
  i.block_attachment,
  i.created_at,
  i.updated_at,
  i.created_by,
  i.created_by_role,
  i.created_by_id,
  COUNT(DISTINCT e.id) as evidence_count,
  COUNT(DISTINCT a.id) as attachment_count,
  p.name as created_by_name,
  pv.validated_at as payment_validated_at,
  pv.validated_by as payment_validated_by
FROM invoices i
LEFT JOIN evidence e ON i.id = e.invoice_id
LEFT JOIN attachments a ON e.id = a.evidence_id
LEFT JOIN profiles p ON i.created_by_id = p.id
LEFT JOIN payment_validations pv ON i.id = pv.invoice_id
GROUP BY
  i.id, i.invoice_number, i.vendor, i.amount, i.currency, i.entity,
  i.po_creator, i.sharepoint_url, i.flow_type, i.current_stage,
  i.source, i.status_detail, i.submission_timestamp, i.payment_status,
  i.payment_blocked, i.block_reason, i.block_attachment, i.created_at,
  i.updated_at, i.created_by, i.created_by_role, i.created_by_id,
  p.name, pv.validated_at, pv.validated_by;
