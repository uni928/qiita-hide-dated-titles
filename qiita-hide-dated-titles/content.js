(() => {
  "use strict";

  // ---- 日付検出 ----
  // 例: 2025年2月12日 / 2025-2-12 / 2025/02/12 / 2025.2.12 / 2025_2_12 / 2025 2 12
  // 「年・月・日」が揃っている場合のみ対象
  // ※月日が 1～12, 1～31 の範囲かもチェック
  const DATE_REGEX = /(?<!\d)(\d{4})\s*(?:年|[\/\-._\s])\s*(\d{1,2})\s*(?:月|[\/\-._\s])\s*(\d{1,2})\s*(?:日)?(?!\d)/;

  function isValidYMD(y, m, d) {
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // 実在日付チェック（2025/2/31 みたいなものを弾く）
    // JS Dateは 2025-02-31 を 3/3 に繰り上げるので、逆算一致で判定
    const dt = new Date(year, month - 1, day);
    return (
      dt.getFullYear() === year &&
      dt.getMonth() === month - 1 &&
      dt.getDate() === day
    );
  }

  function titleHasFullDate(titleText) {
    if (!titleText) return false;
    const m = titleText.match(DATE_REGEX);
    if (!m) return false;
    const [, y, mo, d] = m;
    return isValidYMD(y, mo, d);
  }

  // ---- Qiita一覧の「記事カード」を探して隠す ----
  // QiitaのDOMは変わる可能性があるので、なるべく保守的に
  // 「リンク要素っぽいタイトル」を拾って、そこから親カードを辿って display:none
  const PROCESSED_ATTR = "data-qhdt-processed";

  function findTitleElements(root = document) {
    // 優先度: h1/h2/h3 内のリンク、または aria-label/role に頼らず広めに拾う
    // Qiitaはカード内にタイトルリンクがあることが多い
    const selectors = [
      "h1 a", "h2 a", "h3 a",
      "a[href^='/']"
    ].join(",");

    const nodes = Array.from(root.querySelectorAll(selectors));
    // 文字が短すぎる/長すぎるものや空は除外（誤爆軽減）
    return nodes.filter(a => {
      const t = (a.textContent || "").trim();
      return t.length >= 6 && t.length <= 120;
    });
  }

  function findCardContainerFromTitleEl(titleEl) {
    // タイトル要素から「記事カードっぽい」コンテナへ上に辿る
    // Qiitaの一覧は <article> を使うことが多いので最優先
    const article = titleEl.closest("article");
    if (article) return article;

    // 次点: li（リスト）、または大きめのブロック
    const li = titleEl.closest("li");
    if (li) return li;

    // 最後の手段: a の親を適度に
    return titleEl.parentElement;
  }

  function hideIfDated(titleEl) {
    if (!titleEl || titleEl.getAttribute(PROCESSED_ATTR) === "1") return;

    const titleText = (titleEl.textContent || "").trim();
    titleEl.setAttribute(PROCESSED_ATTR, "1");

    if (!titleHasFullDate(titleText)) return;

    const card = findCardContainerFromTitleEl(titleEl);
    if (!card) return;

    // 非表示
    card.style.display = "none";
  }

  function scan(root = document) {
    if (location.pathname.includes("/items/")) return;
    const titles = findTitleElements(root);
    for (const t of titles) hideIfDated(t);
  }

  // 初回スキャン
  scan(document);

  // 無限スクロール・遅延描画に対応
  const observer = new MutationObserver((mutations) => {
    for (const mu of mutations) {
      for (const node of mu.addedNodes) {
        if (!(node instanceof Element)) continue;
        scan(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

})();
