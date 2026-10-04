import { PageHeader } from "@/components/admin/shell/PageHeader";
import { requireAdmin } from "@/server/auth/session";
import { listNotesAdmin } from "@/server/catalog/notes";
import { NotesView, NewNoteButton } from "./NotesView";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  await requireAdmin("products.manage");
  const notes = await listNotesAdmin();
  return (
    <>
      <PageHeader
        title="Notes"
        description="The ingredients in each fragrance's pyramid, with their photos. Add a note here, then put it in a fragrance from Products → Notes."
        actions={<NewNoteButton />}
      />
      <NotesView notes={notes} />
    </>
  );
}
