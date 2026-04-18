import { assertUserModuleEnabled } from "@/lib/modules/assert-user-module";

export default async function AviatorSectionLayout({ children }) {
  await assertUserModuleEnabled("aviator");
  return children;
}
