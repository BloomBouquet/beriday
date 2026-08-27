const previewItems = [
  { label: '일반쓰레기', state: '지역 설정 후 확인', icon: '●' },
  { label: '음식물', state: '오늘 일정 계산', icon: '▲' },
  { label: '재활용', state: '다음 배출일 안내', icon: '◆' },
];

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="버리데이 홈">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>버리데이</span>
        </a>
        <span className="source-chip">공공데이터 기반</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">오늘, 이 동네에서</p>
          <h1>오늘 버릴 수 있는 것부터 확인하세요</h1>
          <p className="hero-description">
            복잡한 지자체 안내를 다시 찾지 않아도 돼요. 지역을 한 번 선택하면
            생활쓰레기, 음식물, 재활용 배출 가능 시간과 다음 일정을 빠르게 보여드려요.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button">지역 설정하기</button>
            <span className="privacy-note">GPS 없이 행정구역만 저장합니다.</span>
          </div>
        </div>

        <aside className="today-preview" aria-label="오늘 일정 미리보기">
          <div className="preview-heading">
            <span>오늘의 배출</span>
            <span className="preview-status">지역 미설정</span>
          </div>
          <div className="preview-list">
            {previewItems.map((item) => (
              <div className="preview-item" key={item.label}>
                <span className="preview-icon" aria-hidden="true">{item.icon}</span>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.state}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="preview-footnote">정보가 모호하면 임의로 판단하지 않고 ‘확인 필요’로 표시합니다.</p>
        </aside>
      </section>

      <section className="feature-grid" aria-label="버리데이 주요 기능">
        <article>
          <span className="feature-index">01</span>
          <h2>오늘 먼저</h2>
          <p>지도보다 먼저 지금 배출 가능한 품목과 시간을 확인합니다.</p>
        </article>
        <article>
          <span className="feature-index">02</span>
          <h2>근거까지</h2>
          <p>각 일정에 공식 출처와 담당기관 정보를 함께 연결합니다.</p>
        </article>
        <article>
          <span className="feature-index">03</span>
          <h2>개인정보 최소화</h2>
          <p>상세 주소나 위치 이력 없이 선택한 행정구역만 기기에 저장합니다.</p>
        </article>
      </section>
    </main>
  );
}
