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
    crafting: ["Crafting", "Chế tạo"],
    craftingDescription: [
      "Estimate modifier odds and test currency sequences on ordinary, uninfluenced equipment.",
      "Ước tính xác suất ra dòng thuộc tính và thử chuỗi currency trên trang bị thường không có influence."
    ],
    craftingRetry: ["Retry loading", "Thử tải lại"],
    craftingItem: ["Item setup", "Thiết lập vật phẩm"],
    craftingChooseGroup: ["Choose an item group", "Chọn nhóm vật phẩm"],
    craftingChooseClass: ["Choose an item class", "Chọn loại vật phẩm"],
    craftingChooseBase: ["Choose an item base", "Chọn vật phẩm cơ sở"],
    craftingSelectGroup: ["Select group", "Chọn nhóm"],
    craftingSelectClass: ["Select class", "Chọn loại"],
    craftingSelectBase: ["Select base", "Chọn vật phẩm cơ sở"],
    craftingSelectGroupFirst: ["Select a group first", "Chọn nhóm trước"],
    craftingSelectClassFirst: ["Select a class first", "Chọn loại trước"],
    craftingGroup_bodyArmour: ["Body Armour", "Giáp thân"],
    craftingGroup_boots: ["Boots", "Giày"],
    craftingGroup_charts: ["Charts", "Hải đồ"],
    craftingGroup_clusterJewel: ["Cluster Jewel", "Cluster Jewel"],
    craftingGroup_flask: ["Flask", "Bình"],
    craftingGroup_gloves: ["Gloves", "Găng tay"],
    craftingGroup_heist: ["Heist", "Heist"],
    craftingGroup_helmet: ["Helmet", "Mũ"],
    craftingGroup_invitation: ["Invitation", "Lời mời"],
    craftingGroup_jewel: ["Jewel", "Ngọc"],
    craftingGroup_jewellery: ["Jewellery", "Trang sức"],
    craftingGroup_mapping: ["Mapping", "Bản đồ"],
    craftingGroup_miscellaneous: ["Miscellaneous", "Khác"],
    craftingGroup_offhand: ["Offhand", "Tay phụ"],
    craftingGroup_oneHanded: ["One-Handed Weapon", "Vũ khí một tay"],
    craftingGroup_relic: ["Relic", "Di vật"],
    craftingGroup_strongboxes: ["Strongboxes", "Hòm khóa"],
    craftingGroup_twoHanded: ["Two-Handed Weapon", "Vũ khí hai tay"],
    craftingLevel: ["Item level", "Cấp vật phẩm"],
    craftingSearch: ["Find a modifier", "Tìm thuộc tính"],
    craftingSearchExample: ["e.g. maximum life", "VD: maximum life"],
    craftingTier: ["Target tier", "Bậc mục tiêu"],
    craftingExact: ["Selected tier", "Bậc đã chọn"],
    craftingMinimum: ["Selected tier or better", "Bậc đã chọn hoặc cao hơn"],
    craftingFamily: ["Any tier", "Mọi bậc"],
    craftingPoolHelp: ["Open a modifier’s tiers with the arrow. Select a Normal tier to add it to your targets.", "Bấm mũi tên để xem các bậc. Chọn một bậc thuộc tính thường để thêm vào mục tiêu."],
    craftingTableChanceHelp: ["Roll odds use the unmodified base at this item level, regardless of filters.", "Xác suất dựa trên vật phẩm cơ sở chưa có thuộc tính ở cấp này, bất kể bộ lọc."],
    craftingTableTiers: ["Tiers", "Bậc"],
    craftingTableLevel: ["iLvl", "Cấp"],
    craftingTableSideChance: ["Side %", "Loại %"],
    craftingTablePoolChance: ["Pool %", "Tổng %"],
    craftingTableDetails: ["Tier details", "Chi tiết bậc"],
    craftingToggleTiers: ["{count} tiers for {modifier}", "{count} bậc của {modifier}"],
    craftingTotals: ["Totals", "Tổng"],
    craftingWeight: ["Weight", "Trọng số"],
    craftingSideChance: ["Side chance", "Xác suất theo loại"],
    craftingPoolChance: ["Pool chance", "Xác suất toàn bộ"],
    craftingBrowseOnly: ["Modifier reference for this base.", "Danh sách thuộc tính tham khảo cho vật phẩm cơ sở này."],
    craftingPoolTitle: ["Modifier pool", "Danh sách thuộc tính"],
    craftingOrigin_normal: ["Normal mods pool", "Danh sách thuộc tính thường"],
    craftingOrigin_crafted: ["Crafted", "Bàn chế tạo"],
    craftingOrigin_shaper: ["Shaper", "Shaper"],
    craftingOrigin_elder: ["Elder", "Elder"],
    craftingOrigin_crusader: ["Crusader", "Crusader"],
    craftingOrigin_adjudicator: ["Warlord", "Warlord"],
    craftingOrigin_basilisk: ["Hunter", "Hunter"],
    craftingOrigin_eyrie: ["Redeemer", "Redeemer"],
    craftingOrigin_essence: ["Essence", "Essence"],
    craftingTargetsTitle: ["Target modifiers", "Thuộc tính mục tiêu"],
    craftingModifierType: ["Modifier type", "Loại thuộc tính"],
    craftingTagFilter: ["Tag filter", "Lọc theo nhãn"],
    craftingNonTag: ["Non-{tag}", "Không có {tag}"],
    craftingOriginFilter: ["Modifier origin", "Nguồn thuộc tính"],
    craftingAllOrigins: ["All origins", "Tất cả nguồn"],
    craftingOriginUnavailable: ["This modifier origin is unavailable for the selected base.", "Nguồn thuộc tính này không có trên vật phẩm cơ sở đã chọn."],
    craftingLockedHelp: ["Dimmed tiers require a higher item level.", "Các bậc hiển thị mờ yêu cầu cấp vật phẩm cao hơn."],
    craftingAllTypes: ["All types", "Tất cả loại"],
    craftingAllTags: ["All tags", "Tất cả nhãn"],
    craftingMatchCount: ["Matching modifier tiers · {count}", "Số bậc thuộc tính phù hợp · {count}"],
    craftingPrefixes: ["Prefixes", "Tiền tố"],
    craftingSuffixes: ["Suffixes", "Hậu tố"],
    craftingPreview: ["Item preview", "Xem vật phẩm"],
    craftingChooseCurrency: ["Choose a currency", "Chọn currency"],
    craftingSelectCurrency: ["Select currency", "Chọn currency"],
    craftingSelectCurrencyFirst: ["Choose a currency, then click the item to apply it.", "Chọn currency, sau đó bấm vào vật phẩm để sử dụng."],
    craftingClickItem: ["Click the item to apply {currency}.", "Bấm vào vật phẩm để dùng {currency}."],
    craftingUndo: ["Undo", "Hoàn tác"],
    craftingReset: ["Reset item", "Đặt lại vật phẩm"],
    craftingCannotApply: ["That currency cannot be applied to the current item.", "Không thể dùng currency đó cho vật phẩm hiện tại."],
    craftingTransfer: ["Simulate this outcome", "Mô phỏng kết quả này"],
    craftingPreviewStart: ["Current item preview", "Vật phẩm đang xem"],
    craftingUseSample: ["Use in item preview", "Dùng trong phần xem vật phẩm"],
    craftingGoal: ["Success requires", "Điều kiện thành công"],
    craftingAll: ["All targets", "Tất cả mục tiêu"],
    craftingAny: ["Any target", "Một mục tiêu bất kỳ"],
    craftingOpenPrefixes: ["Minimum open prefixes", "Số tiền tố trống tối thiểu"],
    craftingOpenSuffixes: ["Minimum open suffixes", "Số hậu tố trống tối thiểu"],
    craftingTool: ["Crafting tool", "Công cụ chế tạo"],
    craftingCalculator: ["Calculator", "Tính xác suất"],
    craftingSimulator: ["Simulator", "Mô phỏng"],
    craftingSetup: ["Crafting setup", "Thiết lập chế tạo"],
    craftingCalculatorHelp: ["Estimate the chance that one use of a currency rolls your targets.", "Ước tính xác suất đạt mục tiêu sau một lần dùng currency."],
    craftingCalculatePreview: ["Start with the current item preview", "Bắt đầu với vật phẩm đang xem"],
    craftingCurrency: ["Currency", "Currency"],
    craftingRarity: ["Starting item", "Vật phẩm ban đầu"],
    craftingNormalStart: ["Normal · no modifiers", "Thường · không có thuộc tính"],
    craftingMagicStart: ["Magic · random modifiers", "Phép · thuộc tính ngẫu nhiên"],
    craftingRareStart: ["Rare · random modifiers", "Hiếm · thuộc tính ngẫu nhiên"],
    craftingAddStep: ["Add step", "Thêm bước"],
    craftingRestorePlan: ["Restore previous plan", "Khôi phục quy trình trước"],
    craftingSimulatorHelp: ["Each trial starts with a fresh item. Conditions are checked before every use.", "Mỗi lần thử bắt đầu với vật phẩm mới. Điều kiện được kiểm tra trước mỗi lần dùng."],
    craftingTrials: ["Trials", "Số lần thử"],
    craftingCalculate: ["Estimate odds", "Ước tính xác suất"],
    craftingRunSimulation: ["Run simulation", "Chạy mô phỏng"],
    craftingCancel: ["Cancel", "Hủy"],
    craftingResults: ["Results", "Kết quả"],
    craftingLoading: ["Loading crafting data…", "Đang tải dữ liệu chế tạo…"],
    craftingLoadError: ["Could not load crafting data.", "Không tải được dữ liệu chế tạo."],
    craftingOutdatedPage: ["Crafting has been updated. Reload the page to continue.", "Tính năng chế tạo đã được cập nhật. Hãy tải lại trang để tiếp tục."],
    craftingStartupError: ["Could not start Crafting. Reload the page to try again.", "Không thể mở tính năng chế tạo. Hãy tải lại trang để thử lại."],
    craftingLocalFileError: ["Open the site through a local web server to use Crafting.", "Hãy mở trang bằng máy chủ web cục bộ để sử dụng tính năng chế tạo."],
    craftingRunError: ["Could not complete the crafting run. Try again.", "Không hoàn thành được lượt thử. Hãy thử lại."],
    craftingNoModifiers: ["No matching modifiers", "Không có thuộc tính phù hợp"],
    craftingPrefix: ["Prefix", "Tiền tố"],
    craftingSuffix: ["Suffix", "Hậu tố"],
    craftingConditionalWeight: ["conditional", "có điều kiện"],
    craftingRemoveItem: ["Remove {item}", "Xóa {item}"],
    craftingStep: ["Step {number}", "Bước {number}"],
    craftingRepeat: ["Max uses", "Số lần dùng tối đa"],
    craftingCondition: ["Apply when", "Dùng khi"],
    craftingAlways: ["Always", "Luôn dùng"],
    craftingIfHit: ["Goal is met", "Đã đạt mục tiêu"],
    craftingIfMiss: ["Goal is unmet", "Chưa đạt mục tiêu"],
    craftingRoutes: ["Routes after this step", "Đường đi sau bước này"],
    craftingOnHit: ["If the goal is met", "Nếu đã đạt mục tiêu"],
    craftingOnMiss: ["If the goal is unmet", "Nếu chưa đạt mục tiêu"],
    craftingNextStep: ["Next step", "Bước tiếp theo"],
    craftingFinishTrial: ["Finish trial", "Kết thúc lượt thử"],
    craftingUnfinished: ["{count} trials reached the 100-step route limit and counted as unsuccessful.", "{count} lần thử đạt giới hạn 100 bước và được tính là không thành công."],
    craftingUp: ["Move step {number} up", "Đưa bước {number} lên"],
    craftingDown: ["Move step {number} down", "Đưa bước {number} xuống"],
    craftingNeedTarget: ["Add at least one target modifier or require an open affix slot.", "Thêm ít nhất một thuộc tính mục tiêu hoặc yêu cầu một ô thuộc tính trống."],
    craftingNeedStep: ["Add at least one currency step.", "Thêm ít nhất một bước dùng currency."],
    craftingIdle: ["Run the tool to see results here.", "Chạy công cụ để xem kết quả tại đây."],
    craftingRunning: ["Running trials…", "Đang chạy thử nghiệm…"],
    craftingCancelled: ["Run canceled.", "Đã hủy lượt thử."],
    craftingHitCount: ["{hits} of {trials} trials met the goal.", "{hits} trong {trials} lần thử đạt mục tiêu."],
    craftingRange: ["95% estimated interval · {low}–{high}", "Khoảng ước tính 95% · {low}–{high}"],
    craftingTrialCount: ["{trials} trials completed.", "Đã hoàn thành {trials} lần thử."],
    craftingPerTarget: ["By target", "Theo mục tiêu"],
    craftingUsage: ["Average currency per trial", "Currency trung bình mỗi lần thử"],
    craftingSkipped: ["{count} step applications were ineligible and used no currency.", "{count} lượt áp dụng không đủ điều kiện và không tốn currency."],
    craftingExample: ["Example final item", "Ví dụ vật phẩm cuối"],
    craftingNoAffixes: ["No explicit modifiers", "Không có thuộc tính hiện"],
    craftingNormal: ["Normal", "Thường"],
    craftingMagic: ["Magic", "Phép"],
    craftingRare: ["Rare", "Hiếm"],
    craftingDataSource: ["Modifier data from RePoE · {revision}", "Dữ liệu thuộc tính từ RePoE · {revision}"],
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
    marketError: ["Could not load {game} exchange data.", "Không tải được dữ liệu trao đổi của {game}."],
    marketUnreachable: ["The exchange snapshot could not be reached from this browser.", "Trình duyệt không truy cập được dữ liệu trao đổi."],
    marketRetry: ["The exchange snapshot could not be reached from this browser. Refresh again or try the other game tab.", "Trình duyệt không truy cập được dữ liệu trao đổi. Hãy cập nhật giá hoặc thử tab của trò chơi còn lại."],
    marketHour: ["Market hour {date} | {costs}", "Giờ ghi nhận {date} | {costs}"],
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
    trendSearchResults: ["{count} matches vs {name}{excluded}, sorted by total difference", "{count} kết quả so với {name}{excluded}, sắp xếp theo tổng chênh lệch"],
    oneTypeExcluded: [", {count} type excluded", ", đã loại trừ {count} loại"],
    typesExcluded: [", {count} types excluded", ", đã loại trừ {count} loại"],
    noSearchResults: ['No items match "{search}"', 'Không có vật phẩm nào khớp với “{search}”'],
    noHistoricalPairs: ["No historical pairs found vs {name} with volume > {volume}", "Không có dữ liệu về cặp trao đổi với {name} có khối lượng > {volume}"],
    noHistoricalMatches: ["No items with price history match the current filters.", "Không có vật phẩm nào có lịch sử giá khớp với bộ lọc hiện tại."],
    showHistory: ["Show 7 day price history", "Xem lịch sử giá 7 ngày"],
    history: ["7 day price history", "Lịch sử giá 7 ngày"],
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
