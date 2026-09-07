import Link from 'next/link';

export const metadata = {
  title: 'プライバシーポリシー | ANA マイレージ＆PP管理',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-6 max-w-3xl mx-auto font-sans leading-relaxed">
      <h1 className="text-2xl font-bold mb-6 border-b pb-3 text-slate-900">プライバシーポリシー</h1>

      <section className="space-y-6 text-sm text-slate-700">
        <div>
          <h2 className="font-bold text-base text-slate-900 mb-2">1. 広告の配信について</h2>
          <p>当サイトでは、第三者配信の広告サービス「Google AdSense」を利用する予定です。広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、当サイトや他サイトへのアクセスに関する情報「Cookie」（氏名、住所、メール アドレス、電話番号は含まれません）を使用することがあります。</p>
        </div>

        <div>
          <h2 className="font-bold text-base text-slate-900 mb-2">2. データの取得と管理</h2>
          <p>当サイトでは、アカウント管理およびフライトデータのクラウド同期・フィードバック収集のために Supabase を利用しています。取得した個人情報は適切に管理し、法的義務がある場合を除き、第三者へ開示・提供することはありません。</p>
        </div>

        <div>
          <h2 className="font-bold text-base text-slate-900 mb-2">3. 免責事項</h2>
          <p>当サイトのコンテンツ・情報について、可能な限り正確な情報を掲載するよう努めておりますが、正確性や安全性を保証するものではありません。当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。</p>
        </div>

        <div>
          <h2 className="font-bold text-base text-slate-900 mb-2">4. お問い合わせ</h2>
          <p>当サイトへのお問い合わせやご意見・ご要望は、トップページ右下の「ご要望・改善案」フォームより送信してください。</p>
        </div>
      </section>

      <div className="mt-10 pt-6 border-t border-slate-200">
        <Link href="/" className="text-blue-600 font-bold hover:underline text-sm flex items-center gap-1">
          ← トップページへ戻る
        </Link>
      </div>
    </main>
  );
}