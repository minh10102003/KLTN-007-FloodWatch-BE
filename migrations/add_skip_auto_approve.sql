-- Migration: moderator bỏ qua auto-approve cho báo cáo cụ thể (chỉ duyệt thủ công)
ALTER TABLE crowd_reports
ADD COLUMN IF NOT EXISTS skip_auto_approve BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN crowd_reports.skip_auto_approve IS
  'TRUE nếu moderator đã bỏ qua auto-approve — báo cáo pending không bị duyệt tự động theo cụm';

CREATE INDEX IF NOT EXISTS idx_crowd_reports_skip_auto_approve
    ON crowd_reports (skip_auto_approve)
    WHERE skip_auto_approve = TRUE;
