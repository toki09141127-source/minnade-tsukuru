import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>制作ルーム一覧</h1>

      <p style={{ marginTop: 8 }}>
        <Link href="/profile">ユーザー名を設定</Link>
      </p>

      <p style={{ marginTop: 8 }}>
        <Link href="/rooms">（旧）/rooms を開く</Link>
      </p>

      <p style={{ marginTop: 16 }}>
        <Link href="/rooms/new">＋ ルームを作成</Link>
      </p>

      <p style={{ marginTop: 16 }}>
        ※ ルーム一覧本体は <Link href="/rooms">/rooms</Link> に置いてもOKだけど、<br />
        迷子防止のためトップを一覧に固定してる。
      </p>
    </div>
  )
}
