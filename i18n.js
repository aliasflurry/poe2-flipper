const I18n = (() => {
  const storageKey = "poe-exchange-language";
  const messages = {
    pageTitle: ["PoE Exchange Path Finder", "PoE – Tìm lộ trình trao đổi"],
    appTitle: ["Exchange Path Finder", "Tìm lộ trình trao đổi"],
    game: ["Game", "Trò chơi"],
    tools: ["Tools", "Công cụ"],
    language: ["Language", "Ngôn ngữ"],
    auto: ["Auto", "Tự động"],
    resetOverrides: ["Reset overrides", "Xóa tỷ giá tự đặt"],
    refresh: ["Refresh prices", "Cập nhật giá"],
    exchange: ["Exchange", "Trao đổi"],
    trends: ["Price trends", "Xu hướng giá"],
    campaign: ["Campaign", "Campaign"],
    startCurrency: ["Start currency", "Currency ban đầu"],
    startAmount: ["Starting amount", "Số lượng ban đầu"],
    pathLength: ["Path length", "Độ dài lộ trình"],
    bothTrades: ["2 and 3 trades", "2 và 3 lượt giao dịch"],
    twoTrades: ["2 trades", "2 lượt giao dịch"],
    threeTrades: ["3 trades", "3 lượt giao dịch"],
    estimate: ["Estimate", "Ước tính"],
    aboutEstimate: ["About estimate types", "Giới thiệu các kiểu ước tính"],
    conservative: ["Conservative", "Thận trọng"],
    typical: ["Typical", "Điển hình"],
    conservativeHeading: ["Conservative:", "Thận trọng:"],
    typicalHeading: ["Typical:", "Điển hình:"],
    conservativeHelp: [
      "Uses the less favorable end of the recorded hourly price range for each trade. This lowers estimated returns and can hide routes that would be profitable at better prices.",
      "Dùng mức giá kém thuận lợi hơn trong khoảng giá ghi nhận mỗi giờ cho từng giao dịch. Lợi nhuận ước tính sẽ thấp hơn và có thể bỏ qua những lộ trình sinh lời ở mức giá tốt hơn."
    ],
    typicalHelp: [
      "Uses the average exchange ratio calculated from the quantities traded during the hour. This can reveal more potential routes, but you may not be able to trade at those average prices.",
      "Dùng tỷ giá trung bình tính từ số lượng đã giao dịch trong giờ. Cách này có thể tìm ra thêm lộ trình tiềm năng, nhưng bạn có thể không giao dịch được ở các mức giá trung bình đó."
    ],
    estimateDisclaimer: [
      "Both modes use historical data, not live offers. Hourly highs, lows, and averages may come from different moments. Check every trade's price and available stock in game; estimated profit is not guaranteed. Your manual rate edits take priority in either mode.",
      "Cả hai chế độ dùng dữ liệu lịch sử. Mức giá cao nhất, thấp nhất và trung bình trong giờ có thể đến từ các thời điểm khác nhau. Hãy kiểm tra giá và số lượng hiện có trong game trước mỗi giao dịch vì lợi nhuận chỉ là ước tính. Tỷ giá bạn tự đặt được ưu tiên trong cả hai chế độ."
    ],
    conservativeDescription: ["Showing conservative estimates. Only routes with a positive estimated return and matching filters appear, so an item can be present in the data without appearing in a route.", "Đang hiển thị ước tính thận trọng. Chỉ các lộ trình có lợi nhuận ước tính dương và khớp bộ lọc mới xuất hiện. Một vật phẩm có thể có trong dữ liệu mà không xuất hiện trong lộ trình nào."],
    typicalDescription: ["Showing typical estimates. Only routes with a positive estimated return and matching filters appear.", "Đang hiển thị ước tính điển hình. Chỉ các lộ trình có lợi nhuận ước tính dương và khớp bộ lọc mới xuất hiện."],
    minVolume: ["Minimum volume", "Khối lượng tối thiểu"],
    minStock: ["Minimum stock", "Tồn kho tối thiểu"],
    maxGold: ["Max gold cost", "Chi phí Gold tối đa"],
    perPage: ["Per page", "Mỗi trang"],
    excludeItems: ["Exclude items", "Loại trừ vật phẩm"],
    excludeSearch: ["Search item or category to exclude", "Tìm vật phẩm hoặc danh mục cần loại trừ"],
    excludeOptions: ["Items or categories to exclude", "Vật phẩm hoặc danh mục cần loại trừ"],
    includeItems: ["Include items", "Bao gồm vật phẩm"],
    includeSearch: ["Search item or category to include", "Tìm vật phẩm hoặc danh mục cần bao gồm"],
    includeOptions: ["Items or categories to include", "Vật phẩm hoặc danh mục cần bao gồm"],
    categorySelected: ["category selected", "đã chọn danh mục"],
    categoryChip: ["{name} (category)", "{name} (danh mục)"],
    selectCategory: ["Select all {name} items", "Chọn tất cả vật phẩm thuộc {name}"],
    remove: ["Remove {name}", "Bỏ {name}"],
    removeCategory: ["Remove {name} category", "Bỏ danh mục {name}"],
    noPickerResults: ["No matching items or categories", "Không tìm thấy vật phẩm hoặc danh mục phù hợp"],
    unknownItem: ["Unknown item ({id})", "Vật phẩm chưa rõ tên ({id})"],
    unknownCopy: ["Unknown item: {id}. Click to copy ID", "Vật phẩm chưa rõ tên ({id}). Bấm để sao chép ID"],
    otherCategory: ["Other", "Khác"],
    loadingExchange: ["Loading exchange data...", "Đang tải dữ liệu trao đổi…"],
    loadingMarket: ["Loading {game} exchange data...", "Đang tải dữ liệu trao đổi của {game}…"],
    loadedMarket: ["{count} {game} hourly market pairs loaded (estimated rates)", "Đã tải {count} cặp trao đổi theo giờ của {game} (tỷ giá ước tính)"],
    loadedWorkerMarket: ["{count} {game} exchange pairs loaded", "Đã tải {count} cặp trao đổi của {game}"],
    marketError: ["Could not load {game} exchange data.", "Không tải được dữ liệu trao đổi của {game}."],
    marketUnreachable: ["The exchange snapshot could not be reached from this browser.", "Trình duyệt không truy cập được dữ liệu trao đổi."],
    marketRetry: ["The exchange snapshot could not be reached from this browser. Refresh again or try the other game tab.", "Trình duyệt không truy cập được dữ liệu trao đổi. Hãy cập nhật giá hoặc thử tab của trò chơi còn lại."],
    marketHour: ["Market hour {date} | {costs}", "Giờ ghi nhận {date} | {costs}"],
    marketUpdatedAt: ["Updated {date} | {costs}", "Đã cập nhật lúc {date} | {costs}"],
    staleMarketUpdatedAt: ["Updated {date} (stale) | {costs}", "Đã cập nhật lúc {date} (dữ liệu cũ) | {costs}"],
    marketLoadedAt: ["Loaded {date} | {costs}", "Đã tải lúc {date} | {costs}"],
    matchedGold: ["{count} gold costs matched", "Đã đối chiếu {count} mức chi phí Gold"],
    sortResults: ["Sort results", "Sắp xếp kết quả"],
    sortBy: ["Sort by", "Sắp xếp theo"],
    gain: ["Gain %", "Tỷ suất lãi (%)"],
    profit: ["Profit", "Lợi nhuận"],
    profitGold: ["Profit / 1M gold", "Lợi nhuận / 1 triệu Gold"],
    resultPages: ["Result pages", "Trang kết quả"],
    trendsPages: ["Price trends pages", "Trang xu hướng giá"],
    tradeNumber: ["Trade {count}", "Giao dịch {count}"],
    volume: ["vol {count}", "khối lượng {count}"],
    stock: ["stock {count}", "tồn kho {count}"],
    gold: ["gold {count}", "Gold {count}"],
    editRate: ["Edit this exchange rate", "Chỉnh sửa tỷ giá này"],
    overrideRate: ["Override rate. Original: {rate}x", "Tỷ giá tự đặt. Tỷ giá gốc: {rate}x"],
    rateFor: ["Rate for {from} to {to}", "Tỷ giá từ {from} sang {to}"],
    copy: ["Copy {name}", "Sao chép {name}"],
    copied: ["Copied {name}", "Đã sao chép {name}"],
    copyFailed: ["Could not copy {name}", "Không sao chép được {name}"],
    noCurrencies: ["No currencies are available yet.", "Chưa có Currency nào."],
    twoTradeUnavailable: ["Two-trade loops are unavailable from the official hourly market feed. Choose 3 trades.", "Dữ liệu thị trường chính thức theo giờ không hỗ trợ vòng lặp 2 giao dịch. Hãy chọn 3 lượt giao dịch."],
    noProfitableLoops: ["No profitable 3-trade loops match these filters. Try lowering minimum volume or stock.", "Không có vòng lặp 3 giao dịch sinh lời nào khớp bộ lọc. Hãy thử giảm khối lượng hoặc tồn kho tối thiểu."],
    noWorkerLoops: ["No profitable loops match these filters.", "Không có vòng lặp sinh lời nào khớp bộ lọc."],
    previous: ["Previous", "Trước"],
    next: ["Next", "Sau"],
    goToPage: ["Go to page {page}", "Đến trang {page}"],
    pageSummary: ["{first}-{last} of {total} results", "{first}–{last} trên {total} kết quả"],
    searchItems: ["Search items", "Tìm vật phẩm"],
    filterByName: ["Filter by item name", "Lọc theo tên vật phẩm"],
    excludedTypes: ["Excluded types", "Loại vật phẩm bị loại trừ"],
    excludeTypeSearch: ["Search type to exclude", "Tìm loại vật phẩm cần loại trừ"],
    selectTrendsCurrency: ["Select a starting currency to view price trends.", "Chọn Currency ban đầu để xem xu hướng giá."],
    selectCurrency: ["Select a starting currency.", "Chọn Currency ban đầu."],
    loadTrends: ["Load exchange data to view price trends.", "Tải dữ liệu trao đổi để xem xu hướng giá."],
    waitingForData: ["Waiting for exchange data...", "Đang chờ dữ liệu trao đổi…"],
    trendResults: ["{count} items vs {name} (vol > {volume}{excluded}), sorted by total difference", "{count} vật phẩm so với {name} (khối lượng > {volume}{excluded}), sắp xếp theo tổng chênh lệch"],
    oneTypeExcluded: [", {count} type excluded", ", đã loại trừ {count} loại"],
    typesExcluded: [", {count} types excluded", ", đã loại trừ {count} loại"],
    noSearchResults: ['No items match "{search}"', 'Không có vật phẩm nào khớp với “{search}”'],
    noHistoricalPairs: ["No historical pairs found vs {name} with volume > {volume}", "Không có dữ liệu về cặp trao đổi với {name} có khối lượng > {volume}"],
    noHistoricalMatches: ["No matching items with price history and volume over 100 for the current filters.", "Không có vật phẩm nào khớp bộ lọc, có lịch sử giá và khối lượng trên 100."],
    showHistory: ["Show 7 day price history", "Xem lịch sử giá 7 ngày"],
    history: ["7 day price history", "Lịch sử giá 7 ngày"],
    loadingHistory: ["Loading history...", "Đang tải lịch sử giá…"],
    historyChart: ["Seven day price history chart", "Biểu đồ lịch sử giá 7 ngày"],
    snapshots: ["{count} snapshots", "{count} bản ghi"],
    weeklySnapshots: ["{count} snapshots (7 day)", "{count} bản ghi (7 ngày)"],
    noSnapshots: ["No snapshots", "Chưa có bản ghi"],
    historyUnavailable: ["Historical prices will appear here after the snapshot workflow runs.", "Lịch sử giá sẽ xuất hiện sau khi dữ liệu được cập nhật."],
    toggleHistoryLine: ["Toggle this line", "Hiện hoặc ẩn đường này"],
    priceIn: ["Price in {name}", "Giá tính theo {name}"],
    weeklyChange: ["7 day change", "Biến động trong 7 ngày"],
    forecast: ["Linear forecast for the next {count} checkpoints", "Dự báo tuyến tính cho {count} mốc tiếp theo"],
    unavailable: ["n/a", "Không có"],
    campaignGuide: ["Campaign Leveling Guide", "Hướng dẫn lên cấp trong Campaign"],
    loadingProgress: ["Loading progress...", "Đang tải tiến độ…"],
    overallProgress: ["Overall progress", "Tiến độ tổng thể"],
    campaignFilters: ["Campaign filters", "Bộ lọc Campaign"],
    all: ["All", "Tất cả"],
    required: ["Required", "Bắt buộc"],
    optional: ["Optional", "Tùy chọn"],
    resetProgress: ["Reset progress", "Đặt lại tiến độ"],
    confirmResetProgress: ["Reset all campaign checklist progress?", "Đặt lại toàn bộ tiến độ Campaign?"],
    campaignProgress: ["{done} of {total} objectives complete - {percent}", "Đã hoàn thành {done}/{total} mục tiêu ({percent})"],
    permanent: ["Permanent", "Vĩnh viễn"],
    choice: ["Choice", "Lựa chọn"],
    unlocks: ["Unlocks", "Mở khóa"],
    reward: ["Reward", "Phần thưởng"],
    warning: ["Warning", "Cảnh báo"],
    tip: ["Tip", "Mẹo"],
    note: ["Note", "Ghi chú"],
    noCampaign: ["No campaign checklist data is available.", "Chưa có dữ liệu mục tiêu Campaign."],
    noRequired: ["No required objectives in this act.", "Act này không có mục tiêu bắt buộc."],
    noOptional: ["No optional objectives in this act.", "Act này không có mục tiêu tùy chọn."],
    noObjectives: ["No objectives in this act.", "Act này không có mục tiêu nào."],
    loadingCampaign: ["Loading campaign checklist...", "Đang tải danh sách mục tiêu Campaign…"],
    campaignError: ["Could not load campaign checklist.", "Không tải được danh sách mục tiêu Campaign."],
    thirdParty: ["This product isn't affiliated with or endorsed by Grinding Gear Games in any way.", "Sản phẩm này không liên kết với Grinding Gear Games và không được hãng bảo trợ."]
  };

  let locale = "en";

  function t(key, values = {}) {
    const message = messages[key]?.[locale === "vi" ? 1 : 0] ?? messages[key]?.[0] ?? key;
    return message.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(values, name) ? values[name] : token);
  }

  function translateMarkup() {
    document.documentElement.lang = locale;
    const template = document.querySelector("#resultTemplate");
    for (const root of [document, template.content]) {
      for (const element of root.querySelectorAll("[data-i18n]")) {
        element.textContent = t(element.dataset.i18n);
      }
      for (const attribute of ["aria-label", "title", "placeholder"]) {
        for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
          element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
        }
      }
    }
  }

  function init(onChange) {
    const select = document.querySelector("#languageSelect");
    let preference;
    try {
      preference = localStorage.getItem(storageKey);
    } catch {
      // The selector works for this page even if browser storage is blocked.
    }
    select.value = preference === "en" || preference === "vi" ? preference : "auto";

    let lookup;
    function apply(next, initial = false) {
      if (!initial && next === locale) return;
      locale = next;
      translateMarkup();
      if (!initial) onChange();
    }

    async function detectCountry() {
      const request = new AbortController();
      lookup = request;
      const timer = setTimeout(() => request.abort(), 2000);
      let country;
      try {
        const response = await fetch("https://api.country.is/", {
          credentials: "omit",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: request.signal
        });
        if (response.ok) country = (await response.json())?.country;
      } catch {
        // English is already active if the lookup is unavailable.
      } finally {
        clearTimeout(timer);
      }
      if (lookup !== request) return;
      lookup = null;
      if (!request.signal.aborted && country === "VN") apply("vi");
    }

    function update(initial = false) {
      lookup?.abort();
      lookup = null;
      if (select.value === "auto") {
        apply("en", initial);
        void detectCountry();
      } else {
        apply(select.value, initial);
      }
    }

    select.addEventListener("change", () => {
      try {
        localStorage.setItem(storageKey, select.value);
      } catch {
        // Persistence is optional.
      }
      update();
    });
    update(true);
  }

  return { init, t, get locale() { return locale; }, get formatLocale() { return locale === "vi" ? "vi-VN" : "en-US"; } };
})();
