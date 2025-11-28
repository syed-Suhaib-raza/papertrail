import COIForm from '@/components/paper/coi-form';

export default async function AuthorCOIPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  // await params because in Next 13+ dynamic params may be a Promise
  const p = await params;
  const paperId = Array.isArray(p.id) ? p.id[0] : p.id;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Author COI Declaration</h1>
      <COIForm paperId={paperId} role="author" />
    </div>
  );
}