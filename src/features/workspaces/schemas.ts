import { z } from 'zod';

export const workspaceSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(80, 'validation.tooLong'),
  description: z.string().trim().max(500, 'validation.tooLong').optional(),
});

export type WorkspaceInput = z.infer<typeof workspaceSchema>;
