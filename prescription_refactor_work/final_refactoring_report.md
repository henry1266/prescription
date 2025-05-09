# 專案重構總結報告

## 1. 引言

本報告旨在總結對 `prescription` Node.js 專案進行的一系列重構工作。初始專案在可維護性、可擴展性和代碼質量方面存在若干問題，主要表現為高度耦合、代碼重複、配置信息硬編碼以及職責劃分不清。本次重構的目標是解決這些問題，引入更健壯的架構模式，提高代碼的整體質量，使其更易於理解、維護和未來的功能擴展。

## 2. 初始問題識別

在重構開始前，我們對專案進行了分析，主要識別出以下問題：

*   **數據庫連接管理混亂**：專案中存在多個獨立的數據庫連接文件 (`utils/db.js`, `utils/db2.js`)，並且在 `app.js` 中也有直接的數據庫連接邏輯，導致連接管理不統一，難以維護和擴展。
*   **配置信息硬編碼**：數據庫連接字符串、服務器端口、LINE Bot Access Token 等敏感或環境相關的配置信息直接硬編碼在代碼中，降低了應用程式的靈活性和安全性。
*   **路由邏輯重複**：多個路由文件（如 `managePrescriptions.js` 和 `managePrescriptions2.js`）中存在大量相似的業務邏輯和數據庫操作，導致代碼冗餘和維護困難。
*   **職責劃分不清**：`app.js` 和路由文件中混合了路由定義、業務邏輯和直接的數據庫操作，違反了單一職責原則，使得代碼難以理解和測試。
*   **潛在的錯誤和不一致性**：由於代碼重複和耦合，修改一個功能點可能需要在多處進行同步修改，容易引入錯誤和不一致性。

## 3. 重構步驟與變更詳述

針對上述問題，我們分階段進行了以下重構工作：

### 3.1. 統一數據庫連接管理

*   創建了統一的數據庫連接管理模塊 `utils/database.js`。該模塊負責初始化數據庫連接池、提供獲取數據庫實例的接口 (`getDb`) 以及在應用程式關閉時優雅地關閉連接。
*   移除了舊的數據庫連接文件 `utils/db.js` 和 `utils/db2.js`。
*   更新了 `app.js` 和所有路由文件，使其通過 `utils/database.js` 來獲取和使用數據庫連接，確保了數據庫連接的單點管理。

### 3.2. 配置信息外部化

*   引入了 `dotenv` 套件來管理環境變量。
*   創建了 `.env` 文件，將所有硬編碼的配置信息（如 `MONGODB_URI`, `DATABASE_NAME`, `PORT`, `LINE_ACCESS_TOKEN`）遷移到該文件中。
*   修改了 `app.js` 和 `utils/database.js` 等相關模塊，使其從環境變量中讀取配置信息，而不是直接使用硬編碼的值。

### 3.3. 修復錯誤與初步清理

*   在重構過程中，解決了用戶報告的因模塊路徑變更導致的「Cannot find module」錯誤，確保所有路由文件都正確引用了新的數據庫模塊。
*   修復了 `routes/calculate.js` 中的語法錯誤。

### 3.4. 消除代碼重複與職責分離 (初步)

*   **輔助模塊階段 (後被服務層取代)**：
    *   創建了 `utils/prescriptionHelper.js`，將 `managePrescriptions.js` 和 `managePrescriptions2.js` 中重複的處方數據處理、狀態更新和 LINE 通知邏輯提取到共享函數中。
    *   創建了 `utils/appHelper.js`，將 `app.js` 中 `/delete/:id` 路由的數據庫刪除操作提取出來。
*   **動機**：此階段的目標是快速減少最明顯的代碼重複，為後續更深層次的架構重構做準備。

### 3.5. 引入服務層 (Service Layer) 和數據訪問層 (Repository Layer)

這是本次重構的核心步驟，旨在建立清晰的層次化架構：

*   **創建目錄結構**：
    *   `repositories/`：存放數據訪問邏輯模塊。
    *   `services/`：存放業務邏輯模塊。
*   **數據訪問層 (Repositories)**：
    *   `repositories/prescriptionRepository.js`：封裝了所有與 `prescriptions` 集合相關的數據庫操作（如 `find`, `findById`, `updateOne`, `deleteOne`, `updatePreiStatus`）。
    *   `repositories/patientRepository.js`：封裝了與 `patients` 集合相關的數據庫操作（目前主要是 `findByPid`）。
    *   這些 Repository 直接與 `utils/database.js` 交互，對上層服務隱藏了數據庫的具體實現細節。
*   **服務層 (Services)**：
    *   `services/prescriptionService.js`：包含了與處方相關的核心業務邏輯，如獲取分組處方 (`getGroupedPrescriptions`)、更新處方狀態 (`updatePrescriptionStatus`)、發送處方相關通知 (`sendPrescriptionNotification`) 和刪除處方 (`deletePrescription`)。此服務調用 `prescriptionRepository` 和 `patientRepository` 來獲取數據，並調用 `lineService` 來發送通知。
    *   `services/lineService.js`：專門負責處理與 LINE API 的交互，例如發送領藥通知 (`sendRefillNotification`)。它從環境變量中讀取 LINE Access Token。
*   **更新路由和主應用文件**：
    *   重構了 `routes/managePrescriptions.js` 和 `routes/managePrescriptions2.js`，使其調用 `prescriptionService.js` 中的方法來處理業務邏輯，而不是直接操作數據庫或調用舊的輔助函數。
    *   重構了 `app.js` 中的 `/delete/:id` 路由，使其調用 `prescriptionService.js` 的 `deletePrescription` 方法。
*   **移除過時的輔助模塊**：
    *   在所有相關邏輯遷移到新的服務層和數據訪問層後，移除了不再需要的 `utils/prescriptionHelper.js` 和 `utils/appHelper.js` 文件。

## 4. 最終架構概覽

經過重構，專案現在遵循一個更清晰的分層架構：

1.  **路由層 (Routes)**：位於 `routes/` 目錄下，負責接收 HTTP 請求，進行基本的請求參數驗證（可進一步加強），並調用服務層處理業務邏輯。它們不直接與數據庫交互。
2.  **服務層 (Services)**：位於 `services/` 目錄下，包含應用程式的核心業務邏輯。服務層協調一個或多個數據訪問層模塊以及其他服務來完成特定任務。例如，`prescriptionService` 調用 `prescriptionRepository` 和 `patientRepository`。
3.  **數據訪問層 (Repositories)**：位於 `repositories/` 目錄下，負責與數據庫進行交互，執行 CRUD（創建、讀取、更新、刪除）操作。它們對服務層隱藏了數據庫的具體實現。
4.  **工具/基礎設施層 (Utils/Database)**：包含如 `utils/database.js`（數據庫連接管理）、`.env`（配置管理）等基礎模塊。
5.  **主應用文件 (app.js)**：負責設置 Express 應用、加載中間件、註冊路由和啟動服務器。

這種分層架構使得各層職責明確，降低了模塊間的耦合度。

## 5. 重構帶來的益處

本次重構為專案帶來了顯著的益處：

*   **提高可維護性**：代碼結構更清晰，職責更明確，使得理解、修改和調試代碼變得更加容易。
*   **增強可測試性**：服務層和數據訪問層的分離使得單元測試和集成測試更容易實現。可以獨立測試業務邏輯（通過模擬 Repository）和數據訪問邏輯。
*   **降低耦合度**：各層之間通過定義好的接口進行交互，減少了直接依賴，使得系統的某一部分發生變化時，對其他部分的影響降到最低。
*   **提高代碼重用性**：通用的業務邏輯和數據訪問邏輯被封裝在服務和數據訪問層中，可以在不同的路由或應用程式的其他部分中重用。
*   **提升可擴展性**：當需要添加新功能或修改現有功能時，可以在相應的層次上進行擴展，而不會對整個系統造成大的衝擊。
*   **改善配置管理**：通過 `.env` 文件管理配置，使得在不同環境（開發、測試、生產）中部署應用程式更加方便和安全。

## 6. 未來建議

雖然本次重構解決了許多核心問題，但仍有一些可以進一步優化的地方：

*   **全面的輸入驗證**：在路由層或服務層的入口處增加更嚴格的輸入驗證邏輯，以確保數據的有效性和安全性。
*   **統一的錯誤處理機制**：設計一個更統一的錯誤處理中間件，以便更優雅地捕獲和響應不同類型的錯誤。
*   **日誌記錄**：引入更完善的日誌記錄機制（例如使用 Winston 或 Bunyan），以便更好地追蹤應用程式的運行狀態和排查問題。
*   **測試覆蓋**：編寫單元測試和集成測試，確保代碼質量和重構的正確性，並在未來的開發中持續維護測試用例。
*   **API文檔**：如果專案提供 API 接口，可以考慮使用 Swagger/OpenAPI 等工具生成和維護 API 文檔。
*   **持續集成/持續部署 (CI/CD)**：建立 CI/CD 流水線，自動化測試和部署流程。

## 7. 結論

本次對 `prescription` 專案的重構工作取得了顯著的成果。通過引入分層架構（服務層、數據訪問層）、統一數據庫連接管理、外部化配置信息以及消除代碼重複，專案的整體代碼質量、可維護性、可擴展性和可測試性都得到了大幅提升。這些改進為專案未來的健康發展奠定了堅實的基礎。建議團隊在後續開發中繼續遵循良好的軟體工程實踐，以保持代碼庫的質量。

