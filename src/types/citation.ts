/**
 * Citation source types for AI-generated content.
 */

export interface SourceReference {
  index: number;
  reference_label: string;
  source_type: string;
  tool_name: string;
  title: string;
  description?: string;
  url?: string;
  document_id?: string;
  tool_execution_id?: string;
  query?: string;
  snippet?: string;
  full_content?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceTypeConfig {
  label: string;
  color: string;
}
