import { assertUserModuleEnabled } from "@/lib/modules/assert-user-module";

export default async function ChatSectionLayout({ children }) {
  await assertUserModuleEnabled("chat");
  return children;
}
