# PetLife+ 智慧寵物生活管理系統（網頁示意版）

資訊管理學系專題 第 B02 組

以「智慧地圖整合服務」為核心，整合寵物醫療紀錄、美容照護、線上預約、通知提醒與家庭共同管理。

- 線上展示：https://capybara168.github.io/petlife_cycu/
- 示範帳號：`mom@petlife.demo` ／ `1234`

## 功能
- 寵物健康與美容照護管理：醫療紀錄、美容照護紀錄、線上預約（空班時段）、通知提醒
- 智慧地圖整合服務：動物醫院／24H 急診／美容／照護／友善場所查詢、距離・評價・營業時間篩選、導航與路線規劃
- 家庭共同管理：邀請碼綁定、角色權限、跨分頁即時同步

## Google Maps API
在 `config.js` 填入 `GOOGLE_MAPS_API_KEY`，或於網站「設定」頁貼上金鑰（只存在自己的瀏覽器）。
未設定時自動使用 OpenStreetMap / Overpass / OSRM。

> ⚠️ 若把金鑰寫進 `config.js` 並推上公開 repo，請在 Google Cloud 將金鑰限制為 HTTP 參照網址 `https://capybara168.github.io/*`。
