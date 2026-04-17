import { assertUserModuleEnabled } from "@/lib/modules/assert-user-module";

export default async function GamesSectionLayout({ children }) {
  await assertUserModuleEnabled("game");
  return children;
}
