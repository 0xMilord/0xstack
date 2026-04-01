export const testdomainKeys = {
  all: () => ["testdomains"] as const,
  list: () => ["testdomains", "list"] as const,
  detail: (id: string) => ["testdomains", "detail", id] as const,
};
