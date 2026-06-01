import { z } from 'zod';

export const createEntitySchema = z.object({
  type: z.enum(['hostname', 'ip', 'email', 'domain', 'account', 'file', 'process', 'registry', 'certificate', 'url', 'custom']),
  value: z.string().min(1).max(255),
  notes: z.string().optional(),
  entity_details: z.record(z.unknown()).optional(),
});

export const updateEntitySchema = z.object({
  value: z.string().min(1).max(255).optional(),
  notes: z.string().optional(),
  entity_details: z.record(z.unknown()).optional(),
});
