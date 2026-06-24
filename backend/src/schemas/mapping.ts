import { z } from 'zod';

export const killChainMappingSchema = z.object({
  stage_id: z.string().uuid(),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().optional(),
});

export const boundaryMappingSchema = z.object({
  boundary_id: z.string().uuid(),
  direction: z.enum(['ingress', 'egress', 'lateral']),
  notes: z.string().optional(),
});

export const createBoundarySchema = z.object({
  name: z.string().min(1).max(255),
  zone_type: z.enum(['IT', 'OT', 'trusted', 'untrusted', 'dmz']),
  description: z.string().optional(),
});
