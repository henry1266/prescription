# 專案重構與解耦詳細待辦事項清單

本待辦事項清單基於「專案耦合問題分析與改善建議報告」中的建議，旨在指導您逐步重構和解耦現有專案。每個任務都盡可能細化，以確保可操作性。

## 階段一：基礎重構與配置管理 (相對簡單)

### 1. 統一數據庫連接管理

- [ ] **任務 1.1：徹底評估現有數據庫連接方式**
    - [ ] **子任務 1.1.1**: 盤點所有數據庫連接實例及使用方式
        - [ ] **細項 1.1.1.1**: 使用代碼搜索工具 (如 `grep -rnw '/home/ubuntu/prescription' -e 'MongoClient' -e 'client.connect' -e 'client.db'`) 在整個專案中查找 `MongoClient` 實例化、`connect()` 調用、`db()` 調用等關鍵代碼。
        - [ ] **細項 1.1.1.2**: 仔細檢查 `utils/db.js`, `utils/db2.js`, `app.js` 以及 `routes` 目錄下的所有 `.js` 文件。
        - [ ] **細項 1.1.1.3**: 創建一個電子表格或文檔，詳細記錄每個連接點：
            - 文件路徑和行號。
            - 連接是如何初始化的 (例如，`new MongoClient(uri)`)。
            - 連接是如何被使用的 (例如，`client.connect()`, `client.db('pharmacy')`)。
            - 連接是如何關閉的 (例如，`client.close()`)，以及是否在 `finally` 塊中確保關閉。
            - 是否存在潛在的多次連接或連接未關閉的風險。
    - [ ] **子任務 1.1.2**: 深入分析每種連接方式的設計、優缺點及其實際影響
        - [ ] **細項 1.1.2.1**: 分析 `utils/db.js` (導出未連接的 `MongoClient` 實例)：
            - 優點：簡單直接。
            - 缺點：每次使用前都需要手動調用 `connect()`，增加了重複代碼；如果忘記 `close()` 可能導致資源洩漏；不利於集中管理連接配置和狀態。
        - [ ] **細項 1.1.2.2**: 分析 `utils/db2.js` (導出異步 `connectToDatabase` 函數)：
            - 優點：嘗試封裝連接邏輯，異步獲取數據庫實例。
            - 缺點：當前實現中，`client` 仍在模塊級別創建，多次調用 `connectToDatabase` 仍會對同一個 `client` 實例操作；需要評估其是否真正實現了單例連接或連接池的效果。
        - [ ] **細項 1.1.2.3**: 分析 `app.js` 和路由文件中直接創建和管理 `MongoClient` 實例的方式：
            - 優點：無 (在此上下文中，通常不推薦)。
            - 缺點：嚴重的代碼冗餘；配置分散；維護極其困難；極易出錯 (如忘記關閉連接)。
        - [ ] **細項 1.1.2.4**: 撰寫一份簡短的評估總結，明確指出當前連接管理的痛點和必須改進的理由。

- [ ] **任務 1.2：設計並實施一個健壯的、統一的數據庫連接管理模塊 (例如，新建 `utils/database.js`)**
    - [ ] **子任務 1.2.1**: 明確新模塊的設計目標和核心功能
        - [ ] **細項 1.2.1.1**: 確保應用程序生命周期內只有一個 `MongoClient` 實例被創建和連接 (單例模式)。
        - [ ] **細項 1.2.1.2**: 提供一個簡單的接口來獲取已連接的數據庫實例 (例如 `getDb()`)。
        - [ ] **細項 1.2.1.3**: 自動處理應用程序關閉時的數據庫連接釋放。
        - [ ] **細項 1.2.1.4**: 包含清晰的日誌記錄 (連接成功、失敗、關閉)。
        - [ ] **細項 1.2.1.5**: 良好的錯誤處理機制 (例如，連接失敗時應用程序應如何響應)。
    - [ ] **子任務 1.2.2**: 編寫 `utils/database.js` 的代碼
        - [ ] **細項 1.2.2.1**: 內部維護一個 `MongoClient` 實例和一個數據庫實例變量 (初始為 `null`)。
        - [ ] **細項 1.2.2.2**: 實現 `connectToServer(callback)` 或異步 `connectToServer()` 方法：
            - 首次調用時，創建 `MongoClient` 實例，調用 `client.connect()`。
            - 連接成功後，將 `client.db('pharmacy')` (數據庫名應可配置) 賦值給內部數據庫實例變量，並調用回調或解析 Promise。
            - 如果已連接，則直接調用回調或解析 Promise。
            - 處理連接錯誤，並通過回調或 Promise 報告錯誤。
        - [ ] **細項 1.2.2.3**: 實現 `getDb()` 方法：返回已連接的數據庫實例；如果尚未連接，應拋出錯誤或返回 `null` (取決於設計)。
        - [ ] **細項 1.2.2.4**: (推薦) 在 `connectToServer` 中使用 `process.env.MONGODB_URI` 和 `process.env.DB_NAME` 等環境變量配置連接字符串和數據庫名。
    - [ ] **子任務 1.2.3**: 實現應用程序關閉時的優雅關閉邏輯
        - [ ] **細項 1.2.3.1**: 在 `database.js` 中監聽 `process.on('SIGINT', ...)` 和 `process.on('SIGTERM', ...)`。
        - [ ] **細項 1.2.3.2**: 在信號處理函數中，檢查 `MongoClient` 是否存在且已連接，如果是則調用 `client.close()`，並記錄日誌，然後正常退出進程 (`process.exit(0)`)。
    - [ ] **子任務 1.2.4**: (進階) 考慮並實現 MongoDB 驅動內建的連接池
        - [ ] **細項 1.2.4.1**: 查閱 MongoDB Node.js 驅動程序關於 `MongoClient` URI 選項中與連接池相關的參數 (如 `maxPoolSize`, `minPoolSize`, `waitQueueTimeoutMS` 等)。
        - [ ] **細項 1.2.4.2**: 在 `MongoClient` 的 URI 或選項中配置這些參數。
        - [ ] **細項 1.2.4.3**: 理解連接池如何工作，以及它如何幫助管理連接，避免為每個請求創建新連接。

- [ ] **任務 1.3：系統性遷移所有現有代碼以使用新的 `utils/database.js` 模塊**
    - [ ] **子任務 1.3.1**: 在應用程序入口 (`app.js`) 初始化數據庫連接
        - [ ] **細項 1.3.1.1**: 在 `app.js` 的頂部 `require('./utils/database')`。
        - [ ] **細項 1.3.1.2**: 在啟動服務器之前，調用 `database.connectToServer((err) => { ... })`。
        - [ ] **細項 1.3.1.3**: 確保只有在數據庫連接成功後才啟動 Express 服務器監聽端口。
        - [ ] **細項 1.3.1.4**: 移除 `app.js` 中任何舊的、直接的 `MongoClient` 實例化和連接代碼。
    - [ ] **子任務 1.3.2**: 逐個重構所有路由文件 (`routes/*.js`)
        - [ ] **細項 1.3.2.1**: 對於每個路由文件，移除對舊 `utils/db.js`、`utils/db2.js` 或直接 `require('mongodb')` 的依賴 (除非是為了 `ObjectId` 等輔助類型)。
        - [ ] **細項 1.3.2.2**: 引入新的數據庫模塊：`const database = require('../utils/database');`。
        - [ ] **細項 1.3.2.3**: 在每個需要數據庫操作的路由處理函數中，通過 `const db = database.getDb();` 獲取數據庫實例。
        - [ ] **細項 1.3.2.4**: 移除所有路由內部手動的 `client.connect()` 和 `client.close()` 調用。
        - [ ] **細項 1.3.2.5**: 確保所有數據庫操作 (如 `db.collection(...).find(...)`) 都使用通過 `getDb()` 獲取的實例。
    - [ ] **子任務 1.3.3**: 安全刪除廢棄的數據庫連接文件
        - [ ] **細項 1.3.3.1**: 在確認所有代碼都已遷移並測試通過後，從版本控制中刪除 `utils/db.js`。
        - [ ] **細項 1.3.3.2**: 同樣處理 `utils/db2.js` (如果其功能已被新模塊完全覆蓋)。

- [ ] **任務 1.4：全面測試數據庫連接的穩定性、功能正確性及資源管理**
    - [ ] **子任務 1.4.1**: 編寫或更新針對數據庫模塊的單元測試
        - [ ] **細項 1.4.1.1**: 測試 `connectToServer` 在成功和失敗情況下的行為。
        - [ ] **細項 1.4.1.2**: 測試 `getDb` 在連接前後的返回值。
        - [ ] **細項 1.4.1.3**: 模擬應用程序關閉，驗證連接是否被正確關閉。
    - [ ] **子任務 1.4.2**: 執行端到端的功能測試
        - [ ] **細項 1.4.2.1**: 手動或通過自動化測試工具，測試所有涉及數據庫操作的應用功能 (例如，處方查詢、更新、刪除，患者信息獲取等)。
        - [ ] **細項 1.4.2.2**: 檢查應用程序啟動和關閉時的控制台日誌，確認數據庫連接和關閉的日誌信息符合預期。
    - [ ] **子任務 1.4.3**: (可選) 進行簡單的壓力測試
        - [ ] **細項 1.4.3.1**: 使用工具 (如 `Apache Bench (ab)`, `k6`, `Artillery`) 對幾個關鍵 API 端點進行並發請求。
        - [ ] **細項 1.4.3.2**: 監控應用程序響應時間和數據庫連接數 (如果數據庫監控工具可用)，確保在高負載下連接管理依然穩定。

### 2. 外部化並集中管理硬編碼的配置信息

- [ ] **任務 2.1：徹底清查專案中所有硬編碼的配置項**
    - [ ] **子任務 2.1.1**: 系統性搜索數據庫連接字符串
        - [ ] **細項 2.1.1.1**: 搜索類似 `mongodb://localhost:27017` 或 `mongodb://192.168.68.79:27017` 的字符串。
        - [ ] **細項 2.1.1.2**: 記錄它們在 `utils/db.js`, `utils/db2.js`, `app.js` 等文件中的位置。
    - [ ] **子任務 2.1.2**: 系統性搜索 API 密鑰和令牌
        - [ ] **細項 2.1.2.1**: 定位 `routes/managePrescriptions.js` 和 `routes/managePrescriptions2.js` 中的 LINE Bot `accessToken`。
        - [ ] **細項 2.1.2.2**: 檢查是否有其他第三方服務的密鑰或敏感配置被硬編碼。
    - [ ] **子任務 2.1.3**: 識別其他應配置化的參數
        - [ ] **細項 2.1.3.1**: 檢查服務器監聽的端口號 (如 `app.js` 中的 `port = 3001`)。
        - [ ] **細項 2.1.3.2**: 檢查數據庫名稱 (如 `pharmacy`) 是否硬編碼。
        - [ ] **細項 2.1.3.3**: 任何可能在不同部署環境 (開發、測試、生產) 中需要變更的值。

- [ ] **任務 2.2：選擇並實施配置管理方案 (推薦使用 `.env` 文件和 `dotenv` 庫)**
    - [ ] **子任務 2.2.1**: 安裝 `dotenv` 庫
        - [ ] **細項 2.2.1.1**: 在專案根目錄執行 `npm install dotenv --save` 或 `yarn add dotenv`。
    - [ ] **子任務 2.2.2**: 創建 `.env` 文件用於本地開發環境
        - [ ] **細項 2.2.2.1**: 在專案根目錄創建 `.env` 文件。
        - [ ] **細項 2.2.2.2**: 在 `.env` 文件中定義配置變量，例如：
            ```env
            MONGODB_URI="mongodb://localhost:27017"
            DB_NAME="pharmacy"
            LINE_ACCESS_TOKEN="your_actual_line_bot_access_token_here"
            PORT=3001
            ```
    - [ ] **子任務 2.2.3**: 創建 `.env.example` 文件作為配置模板
        - [ ] **細項 2.2.3.1**: 複製 `.env` 文件為 `.env.example`。
        - [ ] **細項 2.2.3.2**: 在 `.env.example` 中移除敏感的實際值，替換為描述或佔位符，例如：
            ```env
            MONGODB_URI="your_mongodb_connection_string"
            DB_NAME="your_database_name"
            LINE_ACCESS_TOKEN="your_line_bot_access_token"
            PORT=3001
            ```
        - [ ] **細項 2.2.3.3**: 將 `.env.example` 提交到版本控制系統。
    - [ ] **子任務 2.2.4**: 將 `.env` 文件添加到 `.gitignore`
        - [ ] **細項 2.2.4.1**: 編輯專案根目錄的 `.gitignore` 文件，添加一行 `*.env` 或直接寫上 `.env`。
        - [ ] **細項 2.2.4.2**: 確保 `.env` 文件不會被提交到 Git 倉庫，以保護敏感信息。
    - [ ] **子任務 2.2.5**: 在應用程序啟動時加載配置
        - [ ] **細項 2.2.5.1**: 在 `app.js` 的最頂部 (所有其他 `require` 之前，除了 Node.js 內建模塊) 添加 `require('dotenv').config();`。

- [ ] **任務 2.3：全面更新代碼以從環境變量中讀取配置**
    - [ ] **子任務 2.3.1**: 修改數據庫連接模塊 (`utils/database.js`)
        - [ ] **細項 2.3.1.1**: 將硬編碼的數據庫 URI 替換為 `process.env.MONGODB_URI`。
        - [ ] **細項 2.3.1.2**: 將硬編碼的數據庫名稱替換為 `process.env.DB_NAME`。
        - [ ] **細項 2.3.1.3**: 提供默認值以防環境變量未設置 (主要用於開發便利，但生產環境應確保設置)。
    - [ ] **子任務 2.3.2**: 修改路由文件中使用 LINE Bot `accessToken` 的地方
        - [ ] **細項 2.3.2.1**: 在 `routes/managePrescriptions.js` 和 `routes/managePrescriptions2.js` (或其他相關文件) 中，將硬編碼的 `accessToken` 替換為 `process.env.LINE_ACCESS_TOKEN`。
    - [ ] **子任務 2.3.3**: 修改 `app.js` 中服務器端口的定義
        - [ ] **細項 2.3.3.1**: 將 `const port = 3001;` 修改為 `const port = process.env.PORT || 3001;`。
    - [ ] **子任務 2.3.4**: 檢查並修改其他所有識別出的硬編碼配置點。

- [ ] **任務 2.4：嚴格測試不同環境下的配置加載和應用行為**
    - [ ] **子任務 2.4.1**: 測試本地開發環境
        - [ ] **細項 2.4.1.1**: 確保 `.env` 文件中的配置被正確加載和使用。
        - [ ] **細項 2.4.1.2**: 驗證所有依賴這些配置的功能 (數據庫連接、LINE 通知、服務器端口) 均正常工作。
    - [ ] **子任務 2.4.2**: 模擬生產環境 (或測試環境)
        - [ ] **細項 2.4.2.1**: 暫時移除或重命名 `.env` 文件。
        - [ ] **細項 2.4.2.2**: 通過命令行設置環境變量來啟動應用 (例如 `PORT=3002 MONGODB_URI=... node app.js`)。
        - [ ] **細項 2.4.2.3**: 驗證應用程序是否使用了通過命令行設置的環境變量，並且功能正常。
        - [ ] **細項 2.4.2.4**: 測試未設置某些環境變量時，應用的行為是否符合預期 (例如，是否使用了合理的默認值，或是否報錯退出)。

## 階段二：代碼重用與職責分離 (中等複雜度)

### 3. 消除路由邏輯中的代碼重複 (重點關注 `managePrescriptions.js` 和 `managePrescriptions2.js`)

- [ ] **任務 3.1：深入分析並詳細記錄 `routes/managePrescriptions.js` 和 `routes/managePrescriptions2.js` 的重複與差異**
    - [ ] **子任務 3.1.1**: 使用代碼比較工具 (如 `diff`, VS Code 的比較功能) 逐行比較這兩個文件。
    - [ ] **子任務 3.1.2**: 列出完全相同的代碼塊：
        - 數據庫連接和集合獲取邏輯。
        - 根據 `pid` 查詢患者信息的邏輯。
        - `update_prei/:id` 路由的處理邏輯。
        - `send_message` 路由中 LINE Bot `accessToken` 的定義和 `axios.post` 的大部分配置。
        - `bubbleMessage` 的大部分結構。
    - [ ] **子任務 3.1.3**: 列出相似但有細微差異的代碼塊：
        - `GET /` 路由中，獲取和格式化處方數據的整體流程相似。
        - 主要差異點：數據分組邏輯 (`groupedPrescriptions.beforeToday.sort` vs `groupedPrescriptions.afterToday.sort` 的排序方向和條件)，以及最終渲染的 EJS 模板 (`manageprescription.ejs` vs `manageprescription2.ejs`)。
        - `send_message` 路由中，傳遞給 `bubbleMessage` 的部分數據 (如 `id`, `precount`, `check`) 可能有細微差異或來源差異。

- [ ] **任務 3.2：設計並提取可重用的輔助函數或服務模塊**
    - [ ] **子任務 3.2.1**: 創建 `services/prescriptionService.js` (如果尚不存在) 或 `utils/prescriptionUtils.js`。
    - [ ] **子任務 3.2.2**: 提取獲取和格式化處方數據的公共邏輯
        - [ ] **細項 3.2.2.1**: 設計一個函數，例如 `async function getFormattedPrescriptions(pid, todayString, sortOptions)`。
        - [ ] **細項 3.2.2.2**: `sortOptions` 可以是一個對象，用於指定排序字段、排序方式、分組邏輯的差異。
        - [ ] **細項 3.2.2.3**: 此函數內部處理數據庫查詢、患者信息關聯、數據格式化和排序。
    - [ ] **子任務 3.2.3**: 提取更新 `prei` 狀態的邏輯
        - [ ] **細項 3.2.3.1**: 設計一個函數，例如 `async function updatePreiStatus(prescriptionId, checkField, newStatus)`。
    - [ ] **子任務 3.2.4**: 提取發送 LINE 通知的邏輯
        - [ ] **細項 3.2.4.1**: 設計一個函數，例如 `async function sendLineNotification(notificationPayload)`。
        - [ ] **細項 3.2.4.2**: `notificationPayload` 應包含所有必要信息 (如 `pline`, `panme`, `startdate`, `enddate`, `id`, `precount`, `prescriptionId`, `check`)。
        - [ ] **細項 3.2.4.3**: 此函數內部處理 `bubbleMessage` 的構建 (可將 `bubbleMessage` 的構建也提取為一個獨立輔助函數) 和 `axios` 推送，以及成功後更新數據庫狀態的邏輯。
        - [ ] **細項 3.2.4.4**: LINE `accessToken` 應從 `process.env` 讀取。

- [ ] **任務 3.3：重構 `managePrescriptions.js` 和 `managePrescriptions2.js` 以調用新的公共模塊**
    - [ ] **子任務 3.3.1**: 修改 `managePrescriptions.js`
        - [ ] **細項 3.3.1.1**: 在 `GET /` 路由中，調用 `prescriptionService.getFormattedPrescriptions(pid, todayString, { groupByToday: true, beforeTodaySort: 'desc', afterTodaySort: 'asc' })` (示例 `sortOptions`)。
        - [ ] **細項 3.3.1.2**: 在 `POST /update_prei/:id` 路由中，調用 `prescriptionService.updatePreiStatus(...)`。
        - [ ] **細項 3.3.1.3**: 在 `POST /send_message` 路由中，調用 `prescriptionService.sendLineNotification(...)`。
        - [ ] **細項 3.3.1.4**: 確保傳遞給服務函數的參數正確無誤。
    - [ ] **子任務 3.3.2**: 修改 `managePrescriptions2.js`
        - [ ] **細項 3.3.2.1**: 在 `GET /` 路由中，調用 `prescriptionService.getFormattedPrescriptions(pid, todayString, { groupByToday: true, beforeTodaySort: 'asc', afterTodaySort: 'asc' })` (注意 `sortOptions` 的差異)。
        - [ ] **細項 3.3.2.2**: `POST` 路由的修改方式與 `managePrescriptions.js` 類似。
    - [ ] **子任務 3.3.3**: (重要) 考慮是否可以合併這兩個路由文件
        - [ ] **細項 3.3.3.1**: 如果重構後，兩個文件的 `GET /` 路由處理器僅僅是傳遞給服務函數的 `sortOptions` 不同以及渲染的模板名不同，則極有可能合併。
        - [ ] **細項 3.3.3.2**: 可以設計一個路由，例如 `/managePrescriptions?viewType=type1` 或 `/managePrescriptions?viewType=type2`，根據 `viewType` 參數決定 `sortOptions` 和渲染的模板。
        - [ ] **細項 3.3.3.3**: 如果決定合併，則刪除其中一個文件，並更新 `app.js` 中的路由註冊。

- [ ] **任務 3.4：對重構後的路由功能進行嚴格測試**
    - [ ] **子任務 3.4.1**: 測試 `managePrescriptions` (或合併後的路由) 的各種場景
        - [ ] **細項 3.4.1.1**: 測試有 `pid` 和無 `pid` 查詢參數的情況。
        - [ ] **細項 3.4.1.2**: 驗證數據的獲取、格式化、分組和排序是否與重構前一致 (或符合新的預期)。
        - [ ] **細項 3.4.1.3**: 驗證 `update_prei` 功能是否正常。
        - [ ] **細項 3.4.1.4**: 驗證 LINE 通知是否能成功發送，並且消息內容正確，數據庫狀態是否按預期更新。
    - [ ] **子任務 3.4.2**: 如果 `managePrescriptions2.js` 未被合併，同樣對其進行完整測試。

### 4. 分離 `app.js` 中直接的數據庫操作邏輯 (例如 `/delete/:id` 路由)

- [ ] **任務 4.1：詳細分析 `app.js` 中的 `/delete/:id` 路由處理器**
    - [ ] **子任務 4.1.1**: 理解其功能：根據 ID 刪除 `prescriptions` 集合中的文檔。
    - [ ] **子任務 4.1.2**: 注意其直接使用了 `client.connect()` 和 `client.close()`，這在統一數據庫連接管理後需要修改。
- [ ] **任務 4.2：將刪除邏輯遷移到更合適的模塊 (例如，一個專門的處方管理路由或服務)**
    - [ ] **子任務 4.2.1**: 創建 (如果尚不存在) 或選擇一個現有的路由文件來承載處方刪除邏輯，例如 `routes/prescriptions.js`。
    - [ ] **子任務 4.2.2**: 在新的路由文件中定義 `DELETE /:id` 或 `POST /delete/:id` 路由。
    - [ ] **子任務 4.2.3**: 將 `app.js` 中的刪除邏輯代碼 (數據庫操作部分) 移至此新路由處理器中。
    - [ ] **子任務 4.2.4**: (推薦) 將實際的數據庫刪除操作封裝到 `prescriptionService.js` 中的一個方法，例如 `async function deletePrescriptionById(id)`，路由處理器調用此服務方法。
    - [ ] **子任務 4.2.5**: 確保遷移後的刪除邏輯使用統一的數據庫連接模塊 (`database.getDb()`)。
- [ ] **任務 4.3：更新 `app.js` 以移除直接的數據庫操作和該路由的定義**
    - [ ] **子任務 4.3.1**: 從 `app.js` 中刪除 `/delete/:id` 路由的完整定義 (`app.post('/delete/:id', ...)` 或 `app.delete(...)`)。
    - [ ] **子任務 4.3.2**: 在 `app.js` 中註冊新的路由文件 (如果創建了新的話)，例如 `app.use('/prescriptions', prescriptionsRouter);`。
- [ ] **任務 4.4：測試遷移後的刪除功能的正確性和錯誤處理**
    - [ ] **子任務 4.4.1**: 測試成功刪除一個存在的處方。
    - [ ] **子任務 4.4.2**: 測試嘗試刪除一個不存在的處方時，應用程序的響應 (例如，404錯誤)。
    - [ ] **子任務 4.4.3**: 測試在數據庫操作失敗時的服務器響應 (例如，500錯誤)。

## 階段三：架構演進與進階優化 (相對複雜)

### 5. 引入服務層 (Service Layer) 和數據訪問層 (DAL/Repository Pattern) 以徹底分離關注點

- [ ] **任務 5.1：詳細規劃服務層和數據訪問層的職責與接口**
    - [ ] **子任務 5.1.1**: 明確各層職責：
        - **Repository 層**: 唯一負責與數據庫直接交互的層。封裝所有 CRUD 操作和數據庫特定的查詢。對上層隱藏數據庫的具體實現 (MongoDB API)。不包含任何業務邏輯。
        - **Service 層**: 包含核心業務邏輯。調用一個或多個 Repository 方法來獲取和持久化數據。執行數據驗證、轉換、組合以及業務規則。不直接與 HTTP 請求/響應打交道，也不直接操作數據庫。
        - **Controller/Router 層**: 負責處理 HTTP 請求和響應。解析請求參數，調用相應的 Service 方法，然後根據 Service 返回的結果構建 HTTP 響應 (渲染視圖或返回 JSON)。保持輕量。
    - [ ] **子任務 5.1.2**: 規劃 Repository 模塊及其方法
        - [ ] **細項 5.1.2.1**: `repositories/prescriptionRepository.js` (示例方法: `findById`, `findAllByPid`, `create`, `update`, `deleteById`, `updateStatus`)
        - [ ] **細項 5.1.2.2**: `repositories/patientRepository.js` (示例方法: `findByPid`, `findAll`, `create`, `update`)
        - [ ] **細項 5.1.2.3**: 每個方法都應接收必要的參數，並返回 Promise<數據> 或 Promise<操作結果>。
    - [ ] **子任務 5.1.3**: 規劃 Service 模塊及其方法
        - [ ] **細項 5.1.3.1**: `services/prescriptionService.js` (示例方法: `getDetailedPrescriptionInfo`, `managePrescriptionsView`, `updatePrescriptionStatusAndNotify`, `deletePrescription`)
        - [ ] **細項 5.1.3.2**: `services/patientService.js` (示例方法: `getPatientDetails`)
        - [ ] **細項 5.1.3.3**: `services/notificationService.js` (示例方法: `sendLinePickupNotification`)
        - [ ] **細項 5.1.3.4**: Service 方法應接收業務相關的參數，內部協調 Repository 和其他 Service。

- [ ] **任務 5.2：逐步實現數據訪問層 (Repositories)**
    - [ ] **子任務 5.2.1**: 創建 `repositories` 文件夾。
    - [ ] **子任務 5.2.2**: 實現 `prescriptionRepository.js`
        - [ ] **細項 5.2.2.1**: 引入統一數據庫模塊 (`require('../utils/database')`)。
        - [ ] **細項 5.2.2.2**: 實現計劃中的每個方法，例如 `async findById(id) { const db = getDb(); return db.collection('prescriptions').findOne({_id: new ObjectId(id)}); }`。
        - [ ] **細項 5.2.2.3**: 確保所有數據庫操作都通過 `getDb()` 獲取的實例執行。
    - [ ] **子任務 5.2.3**: 實現 `patientRepository.js` (類似方式)。
    - [ ] **子任務 5.2.4**: 為 Repository 方法編寫初步的單元測試 (可使用 Mock 數據庫)。

- [ ] **任務 5.3：逐步實現服務層 (Services)**
    - [ ] **子任務 5.3.1**: 創建 `services` 文件夾。
    - [ ] **子任務 5.3.2**: 實現 `prescriptionService.js`
        - [ ] **細項 5.3.2.1**: 引入相關的 Repository (例如 `require('../repositories/prescriptionRepository')`)。
        - [ ] **細項 5.3.2.2**: 實現計劃中的業務邏輯方法。例如，`managePrescriptionsView` 可能會調用 `prescriptionRepository.findAllByPid` 和 `patientRepository.findByPid`，然後組合和格式化數據。
        - [ ] **細項 5.3.2.3**: `updatePrescriptionStatusAndNotify` 可能會先調用 `prescriptionRepository.updateStatus`，成功後再調用 `notificationService.sendLinePickupNotification`。
    - [ ] **子任務 5.3.3**: 實現 `patientService.js` 和 `notificationService.js` (類似方式)。
    - [ ] **子任務 5.3.4**: 為 Service 方法編寫單元測試，Mock掉 Repository 層的依賴。

- [ ] **任務 5.4：大規模重構所有路由處理器以調用服務層方法**
    - [ ] **子任務 5.4.1**: 逐個路由文件進行修改。
    - [ ] **子任務 5.4.2**: 在路由文件中 `require` 相應的 Service 模塊。
    - [ ] **子任務 5.4.3**: 將路由處理器中的業務邏輯和直接數據庫操作，替換為對 Service 方法的調用。
        - 示例前: `router.get('/', async (req, res) => { /* ...大量數據庫操作和業務邏輯... */ });`
        - 示例後: `router.get('/', async (req, res) => { try { const data = await prescriptionService.managePrescriptionsView(req.query.pid); res.render('template', data); } catch (err) { /* 錯誤處理 */ } });`
    - [ ] **子任務 5.4.4**: 確保路由處理器只負責：
        - 從 `req` 中提取參數。
        - 調用 Service 方法並傳遞參數。
        - 根據 Service 返回結果，調用 `res.render()`, `res.json()`, `res.status().send()` 等。
        - 統一的錯誤處理 (可以通過中間件)。

- [ ] **任務 5.5：對分層後的整個應用程序進行徹底的集成測試和回歸測試**
    - [ ] **子任務 5.5.1**: 驗證所有 API 端點和用戶界面的功能是否與重構前保持一致或符合新設計。
    - [ ] **子任務 5.5.2**: 特別關注數據流經 Controller -> Service -> Repository -> Database 以及反向流動的正確性。
    - [ ] **子任務 5.5.3**: 測試邊界條件和錯誤處理路徑。

### 6. 實施其他潛在的改進點 (可根據優先級和資源選擇性實施)

- [ ] **任務 6.1：建立更完善和一致的錯誤處理機制**
    - [ ] **子任務 6.1.1**: 設計自定義錯誤類 (可選)
        - [ ] **細項 6.1.1.1**: 例如 `NotFoundError`, `ValidationError`, `DatabaseError`，繼承自 `Error`，可包含狀態碼等附加信息。
    - [ ] **子任務 6.1.2**: 創建一個統一的錯誤處理中間件
        - [ ] **細項 6.1.2.1**: 在 `app.js` 的末尾註冊一個錯誤處理中間件 (`app.use((err, req, res, next) => { ... })`)。
        - [ ] **細項 6.1.2.2**: 中間件根據錯誤類型 (例如 `err instanceof NotFoundError`) 或狀態碼，向客戶端返回合適的 HTTP 狀態和 JSON 響應或錯誤頁面。
        - [ ] **細項 6.1.2.3**: 在此中間件中集中記錄錯誤日誌 (例如，使用 `console.error(err.stack)` 或更高級的日誌庫)。
    - [ ] **子任務 6.1.3**: 在 Service 層和 Controller 層中，使用 `throw new CustomError(...)` 或 `next(err)` 來傳遞錯誤。

- [ ] **任務 6.2：對所有外部輸入實施嚴格的服務端驗證**
    - [ ] **子任務 6.2.1**: 選擇並集成一個驗證庫
        - [ ] **細項 6.2.1.1**: 例如 `express-validator` 或 `joi`。
        - [ ] **細項 6.2.1.2**: 學習其用法和 API。
    - [ ] **子任務 6.2.2**: 為每個接收用戶輸入的路由 (請求體、查詢參數、路徑參數) 添加驗證規則
        - [ ] **細項 6.2.2.1**: 驗證數據類型 (字符串、數字、布爾等)。
        - [ ] **細項 6.2.2.2**: 驗證數據格式 (郵箱、日期、特定模式等)。
        - [ ] **細項 6.2.2.3**: 驗證數據範圍和長度。
        - [ ] **細項 6.2.2.4**: 驗證必填字段。
    - [ ] **子任務 6.2.3**: 在驗證失敗時，向客戶端返回清晰的錯誤信息 (通常是 400 Bad Request)。

- [ ] **任務 6.3：引入結構化和可配置的日誌記錄系統**
    - [ ] **子任務 6.3.1**: 選擇並集成一個日誌庫
        - [ ] **細項 6.3.1.1**: 例如 `winston` 或 `pino`。
        - [ ] **細項 6.3.1.2**: 配置日誌級別 (debug, info, warn, error)。
        - [ ] **細項 6.3.1.3**: 配置日誌輸出目標 (控制台、文件、遠程日誌服務)。
        - [ ] **細項 6.3.1.4**: 配置日誌格式 (JSON, text)。
    - [ ] **子任務 6.3.2**: 在應用程序的關鍵位置添加日誌記錄
        - [ ] **細項 6.3.2.1**: 應用啟動和關閉。
        - [ ] **細項 6.3.2.2**: 接收到的請求 (可包含請求方法、路徑、來源 IP 等，注意脫敏)。
        - [ ] **細項 6.3.2.3**: 重要的業務操作執行前後。
        - [ ] **細項 6.3.2.4**: 錯誤處理 (已在任務 6.1 中部分涉及)。

- [ ] **任務 6.4：編寫全面的單元測試和集成測試**
    - [ ] **子任務 6.4.1**: 選擇測試框架和工具
        - [ ] **細項 6.4.1.1**: 例如 `Jest`, `Mocha`, `Chai`, `Supertest` (用於 API 集成測試)。
    - [ ] **子任務 6.4.2**: 為 Repository 層編寫單元測試
        - [ ] **細項 6.4.2.1**: Mock 數據庫連接和操作，專注於測試 Repository 方法的邏輯。
    - [ ] **子任務 6.4.3**: 為 Service 層編寫單元測試
        - [ ] **細項 6.4.3.1**: Mock Repository 層的依賴，專注於測試業務邏輯。
    - [ ] **子任務 6.4.4**: 為 API 端點編寫集成測試
        - [ ] **細項 6.4.4.1**: 使用 `Supertest` 等工具，實際啟動應用程序 (或其一部分)，並對 API 端點發送 HTTP 請求，驗證響應狀態、頭部和內容。
        - [ ] **細項 6.4.4.2**: 這些測試可以與真實的測試數據庫交互。
    - [ ] **子任務 6.4.5**: 設定測試覆蓋率目標並持續監控 (可選)。

- [ ] **任務 6.5：(長遠考慮) 評估前端與後端進一步分離的必要性和可行性**
    - [ ] **子任務 6.5.1**: 分析當前 EJS 模板引擎的使用情況和前端複雜度。
    - [ ] **子任務 6.5.2**: 如果前端交互邏輯日益複雜，維護 EJS 模板變得困難，則考慮：
        - 將後端改造為純 API 服務 (RESTful 或 GraphQL)。
        - 使用現代前端框架 (如 React, Vue, Angular) 重新構建前端應用。
    - [ ] **子任務 6.5.3**: 這是一個重大的架構決策，需要仔細評估其優勢 (更清晰的職責分離、獨立部署、更好的開發體驗) 和成本 (遷移工作量、團隊技能要求)。

## 階段四：最終驗收、文檔化與總結

- [ ] **任務 7.1：執行一次完整的、端到端的回歸測試**
    - [ ] **子任務 7.1.1**: 創建一個詳細的測試用例列表，覆蓋所有應用功能和用戶場景。
    - [ ] **子任務 7.1.2**: 按照測試用例逐項執行測試，記錄結果。
    - [ ] **子任務 7.1.3**: 確保所有在重構過程中發現和修復的缺陷都已得到驗證。

- [ ] **任務 7.2：組織代碼審查 (Code Review)**
    - [ ] **子任務 7.2.1**: 邀請團隊成員對所有重構後的代碼進行審查。
    - [ ] **子任務 7.2.2**: 關注點：是否遵循了新的架構設計、代碼可讀性、錯誤處理、測試覆蓋等。
    - [ ] **子任務 7.2.3**: 根據審查反饋進行必要的修改。

- [ ] **任務 7.3：更新或創建相關的專案文檔**
    - [ ] **子任務 7.3.1**: 更新 README.md 文件，說明新的配置方法、啟動步驟、項目結構等。
    - [ ] **子任務 7.3.2**: (如果適用) 創建或更新架構圖，反映新的分層設計。
    - [ ] **子任務 7.3.3**: (如果適用) 更新 API 文檔 (如果後端提供 API)。

- [ ] **任務 7.4：總結本次重構的經驗教訓並規劃後續的迭代和優化**
    - [ ] **子任務 7.4.1**: 記錄在重構過程中遇到的挑戰和解決方案。
    - [ ] **子任務 7.4.2**: 評估重構帶來的改進 (例如，可維護性、可測試性、性能等方面的感受或指標)。
    - [ ] **子任務 7.4.3**: 識別在本次重構中未完成或可進一步優化的點，納入未來的開發計劃。

