import { createServerFn } from "@tanstack/react-start";
import { lookupFromUrl, prepareFromUrl, type PrepareInput } from "./prepare";

export const lookupVideo = createServerFn({ method: "POST" })
  .validator((url: string) => url)
  .handler(async ({ data }) => lookupFromUrl(data));

export const prepareDownload = createServerFn({ method: "POST" })
  .validator((input: PrepareInput) => input)
  .handler(async ({ data }) => prepareFromUrl(data));
