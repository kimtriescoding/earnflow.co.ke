import { assertUserModuleEnabled } from "@/lib/modules/assert-user-module";

export default async function GamesSectionLayout({ children }) {
  await assertUserModuleEnabled("lucky_spin");
  return children;
}
