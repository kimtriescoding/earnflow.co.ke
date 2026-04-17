import { assertUserModuleEnabled } from "@/lib/modules/assert-user-module";

export default async function AcademicSectionLayout({ children }) {
  await assertUserModuleEnabled("academic");
  return children;
}
