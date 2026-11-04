import { z } from "zod";
import { api } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { getLibraryItem } from "@/lib/services/user";
import { trackOpen } from "@/lib/services/usage";
export const GET = api<{ id: string }>(async (_r, { params }) => {
  const id = z.string().uuid().parse(params.id);
  const item = await getLibraryItem(id);
  if (!item) throw notFound();
  void trackOpen("resource", id);
  return item;
});
