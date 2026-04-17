import { assertUserModuleEnabled } from "@/lib/modules/assert-user-module";

export default async function LuckySpinSectionLayout({ children }) {
  await assertUserModuleEnabled("game");
  return children;
}
