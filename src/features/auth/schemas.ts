import { z } from 'zod';

// Messages are translation keys; screens pass them through t().
export const loginSchema = z.object({
  email: z.string().trim().email('validation.email'),
  password: z.string().min(6, 'validation.passwordMin'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(1, 'validation.required'),
    email: z.string().trim().email('validation.email'),
    password: z.string().min(6, 'validation.passwordMin'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'validation.passwordsMismatch',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const resetSchema = z.object({
  email: z.string().trim().email('validation.email'),
});
export type ResetInput = z.infer<typeof resetSchema>;

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, 'validation.required').max(80, 'validation.tooLong'),
});
export type DisplayNameInput = z.infer<typeof displayNameSchema>;
