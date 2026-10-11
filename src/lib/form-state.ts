/**
 * NHR
 * @author Nahid Hasan Rayan
 */

export interface FormState {
  error?: string;
  message?: string;
}

export type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;

export const GENERIC_ERROR = "Something went wrong. Try again.";
