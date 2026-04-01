export type ProviderSignUploadResult = {
  uploadUrl: string;
  /** Extra headers for the upload request (e.g. Supabase upload token). */
  headers?: Record<string, string>;
};

export type ProviderSignReadResult = { url: string };
