/**
 * Zod schemas for the auth screens.
 *
 * Schemas own validation only — server errors (duplicate email, bad
 * credentials, etc.) still surface via `errorMessage(err)` + Alert.alert
 * in each screen's submit handler. RHF wires these through `zodResolver`.
 *
 * Field naming: form fields stay camelCase for ergonomic Controller usage.
 * Mapping to snake_case API payloads happens in the submit handler so the
 * boundary is explicit and reviewable.
 */
import { z } from 'zod';

import { AGE_GROUPS } from '@/constants/kid';

const trimmed = z.string().transform((v) => v.trim());

export const signUpSchema = z.object({
  firstName: trimmed.pipe(z.string().min(1, 'First name is required')),
  lastName: trimmed.pipe(z.string().min(1, 'Last name is required')),
  email: trimmed.pipe(
    z.string().min(1, 'Email is required').email('Enter a valid email'),
  ),
  phone: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .transform((v) => (v ? v : undefined)),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Must be at least 8 characters'),
});

export type SignUpFormValues = z.input<typeof signUpSchema>;
export type SignUpFormOutput = z.output<typeof signUpSchema>;

export const signInSchema = z.object({
  email: trimmed.pipe(
    z.string().min(1, 'Email is required').email('Enter a valid email'),
  ),
  password: z.string().min(1, 'Password is required'),
});

export type SignInFormValues = z.input<typeof signInSchema>;
export type SignInFormOutput = z.output<typeof signInSchema>;

export const addKidSchema = z.object({
  firstName: trimmed.pipe(z.string().min(1, 'First name is required')),
  lastName: trimmed.pipe(z.string().min(1, 'Last name is required')),
  ageGroup: z.enum(AGE_GROUPS).nullable(),
  position: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v.length ? v : null))
    .nullable(),
});

export type AddKidFormValues = z.input<typeof addKidSchema>;
export type AddKidFormOutput = z.output<typeof addKidSchema>;
