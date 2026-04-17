import { assertUserModuleEnabled } from "@/lib/modules/assert-user-module";

export default async function VideosSectionLayout({ children }) {
  await assertUserModuleEnabled("video");
  return children;
}
