import { z } from "zod";
import { api } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { getLibraryItem } from "@/lib/services/user";
export const GET = api<{ id: string }>(async (_r, { params }) => (await getLibraryItem(z.string().uuid().parse(params.id))) ?? (() => { throw notFound(); })());
