/*
 * PetLife+ 設定檔
 * ---------------------------------------------------------------
 * 在下方填入你的 Google Maps API Key，即可啟用 Google 地圖、
 * Places API（真實店家、評價、營業時間）與 Directions 路線規劃。
 *
 * 申請方式：
 *   1. 前往 https://console.cloud.google.com/ 建立專案並啟用帳單
 *   2. 啟用 Maps JavaScript API、Places API (New)、Directions API、Geocoding API
 *   3. 「憑證」→ 建立 API 金鑰（建議限制 HTTP 參照網址為 http://localhost:*）
 *
 * 也可以不改檔案，直接在網站「我的 → 設定」頁面貼上金鑰（存在瀏覽器中）。
 * 未設定金鑰時，系統會自動改用 OpenStreetMap 開放圖資，功能仍可完整展示。
 */
window.PETLIFE_CONFIG = {
  GOOGLE_MAPS_API_KEY: '',
  // 預設地圖中心：桃園市龜山區（長庚大學／林口長庚一帶）
  DEFAULT_CENTER: [25.0336, 121.3893],
};
