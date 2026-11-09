import { Placeholder } from "@/components/Placeholder";

export default function QrError() {
  return <Placeholder title="スタンプを押せませんでした" note="QR の読み取りエラー画面。ローカル版の押印は /qr の合言葉入力が内部でエラー表示します。" />;
}
