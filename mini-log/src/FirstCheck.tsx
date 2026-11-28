import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';

// 처음 쓰는 사람용 체크리스트(오늘 보드 위): 이름 → 메일 연결 → 첫 원고 → 아침 알림. 다 하거나 '그만 보기'를 누르면 사라진다(이 기기에 기억).
const KEY = 'minilog.firstcheck.hidden';
type Go = 'settings' | 'mail';
export function FirstCheck({ name, drafts, onGo, onCreate }: { name: string; drafts: number; onGo: (t: Go) => void; onCreate: () => void }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [mail, setMail] = useState<boolean | null>(null);
  const [push, setPush] = useState<boolean | null>(null);
  useEffect(() => {
    if (hidden) return;
    let alive = true;
    api<{ accounts: { connected: boolean }[] }>('/api/connections').then(d => { if (alive) setMail(d.accounts.some(a => a.connected)); }).catch(() => { if (alive) setMail(null); });
    api<{ devices: number }>('/api/push').then(d => { if (alive) setPush(d.devices > 0); }).catch(() => { if (alive) setPush(null); });
    return () => { alive = false; };
  }, [hidden]);
  if (hidden) return null;
  const items: { key: string; label: string; done: boolean | null; act: string; run: () => void }[] = [
    { key: 'name', label: '화면에 보일 이름 정하기', done: !/^사용자\s?[A-Z]$/.test(name.trim()), act: '이름 정하기', run: () => onGo('settings') },
    { key: 'mail', label: '협찬 메일 받을 메일 연결하기', done: mail, act: '메일 연결', run: () => onGo('mail') },
    { key: 'draft', label: '원고 하나 써 보기', done: drafts > 0, act: '원고 쓰기', run: onCreate },
    { key: 'push', label: '아침 알림 켜기', done: push, act: '알림 켜기', run: () => onGo('settings') },
  ];
  const left = items.filter(i => i.done === false);
  if (mail !== null && push !== null && left.length === 0) return null; // 다 끝나면 안 보임
  const doneN = items.filter(i => i.done).length;
  const hide = () => { setHidden(true); try { localStorage.setItem(KEY, '1'); } catch { /* 이번만 숨김 */ } };
  return (
    <section className="card first-check" aria-labelledby="fc-title">
      <div className="row-between">
        <h2 id="fc-title" className="step-title">시작하기 <span className="step-sub">{doneN}/{items.length}</span></h2>
        <button type="button" className="link-btn small" onClick={hide}>그만 보기</button>
      </div>
      <div className="fc-bar" aria-hidden="true"><i style={{ width: `${(doneN / items.length) * 100}%` }} /></div>
      <ol className="fc-list">
        {items.map((it, i) => (
          <li key={it.key} className={it.done ? 'done' : ''}>
            <span className="fc-n" aria-hidden="true">{it.done ? '✓' : i + 1}</span>
            <span className="fc-t" id={`fc-${it.key}`}>{it.label}</span>
            {it.done === false && <button type="button" className="btn small" aria-describedby={`fc-${it.key}`} onClick={it.run}>{it.act}</button>}
            {it.done && <span className="muted small">끝</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
