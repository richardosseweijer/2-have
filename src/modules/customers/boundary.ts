import { z } from "zod";

const optionalText = z.string().trim().max(160).optional().or(z.literal(""));

export const createCustomerInput = z.object({
  name: z.string().trim().min(1).max(160),
  email: optionalText,
  phone: optionalText,
  city: optionalText,
});

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
};
