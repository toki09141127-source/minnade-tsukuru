export default function Loading() {
  return (
    <div role="status" aria-label="ページを読み込み中">
      <p>読み込んでいます…</p>
      <div className="skeleton" />
    </div>
  );
}
