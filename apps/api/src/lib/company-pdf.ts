/** Shared issuer block for invoice & expense receipt PDFs. */
export const CRES_DYNAMICS_PDF_COMPANY = {
  name: "Cres Dynamics Ltd",
  email: "info@cresdynamics.com",
  phone: "+254 743 869 564 / +254 708 805 496",
  website: "cresdynamics.com",
  address: {
    street: "Kivuli Towers, 3rd floor Westlands",
    city: "Nairobi",
    country: "Kenya",
    postal_code: "P.O. BOX 1112 – 00100"
  },
  tax_id: "____________________"
} as const;

export type PdfCompanyBlock = {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  tax_id?: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
    postal_code?: string;
  };
};
