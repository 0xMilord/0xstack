import crypto from "node:crypto";
import { deleteTestdomain, getTestdomainById, insertTestdomain, listTestdomain, updateTestdomain } from "@/lib/repos/testdomains.repo";

export async function testdomainService_list(input: { orgId: string }) {
  return await listTestdomain({ orgId: input.orgId });
}

export async function testdomainService_getById(input: { id: string; orgId: string }) {
  return await getTestdomainById({ id: input.id, orgId: input.orgId });
}

export async function testdomainService_create(input: { orgId: string; name: string; createdByUserId: string }) {
  return await insertTestdomain({
    id: crypto.randomUUID(),
    name: input.name,
    orgId: input.orgId,
    createdByUserId: input.createdByUserId,
    updatedAt: new Date(),
  });
}

export async function testdomainService_update(input: { id: string; orgId: string; patch: { name?: string } }) {
  return await updateTestdomain({ id: input.id, orgId: input.orgId, patch: input.patch });
}

export async function testdomainService_delete(input: { id: string; orgId: string }) {
  return await deleteTestdomain({ id: input.id, orgId: input.orgId });
}
