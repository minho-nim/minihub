import { useEffect, useRef, useState } from 'react';

// '다음 할 일' 알림: 한 단계를 끝내면(승인·게시 등) 바로 이어서 할 일을 아래에 잠깐 띄운다(10초, 닫기 가능).
// 버튼은 그 칸·화면으로 데려가기만 하고, 대신 무엇을 하지는 않는다.
type Next = { text: string; label?: string; go?: () => void; id: number };
const EVENT = 'minilog-next';
let seq = 0;
export function showNext(text: string, label?: string, go?: () => void) {
  window.dispatchEvent(new CustomEvent<Next>(EVENT, { detail: { text, label, go, id: ++seq } }));
}

export function NextToast() {
  const [item, setItem] = useState<Next | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Next>).detail;
      setItem(d);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setItem(cur => (cur?.id === d.id ? null : cur)), 10000);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); window.clearTimeout(timer.current); };
  }, []);
  if (!item) return null;
  return (
    <div className="next-toast" role="status">
      <span className="next-dot" aria-hidden="true">✓</span>
      <span>{item.text}</span>
      {item.label && item.go && <button type="button" className="next-go" onClick={() => { item.go?.(); setItem(null); }}>{item.label} →</button>}
      <button type="button" className="undo-close" aria-label="알림 닫기" onClick={() => setItem(null)}>×</button>
    </div>
  );
}
