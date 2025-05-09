# 專案耦合問題分析與改善建議報告

## 引言

本報告旨在分析您提供的 GitHub 專案 (`https://github.com/henry1266/prescription.git`) 中存在的代碼耦合現象，並提出具體的改善建議。過度耦合是軟體開發中常見的問題，它會導致系統難以維護、擴展和測試。通過識別和解決這些耦合問題，可以顯著提高代碼質量、降低維護成本並增強系統的健壯性。

在本次分析中，我們對專案的整體結構、文件組織、數據庫交互方式、路由實現以及配置管理等方面進行了檢查。

## 主要耦合問題概述

經過詳細分析，我們在專案中識別出以下主要的耦合問題：

1.  **數據庫連接管理不統一**：專案中存在多種數據庫連接的實現方式 (`utils/db.js`, `utils/db2.js`, 以及在 `app.js` 和部分路由中直接創建連接)，導致代碼冗餘、維護困難和潛在的資源管理風險。
2.  **路由邏輯大量重複**：例如 `routes/managePrescriptions.js` 和 `routes/managePrescriptions2.js` 兩個文件的代碼內容高度相似，幾乎完全重複。這增加了維護成本和出錯的機率。
3.  **硬編碼的配置信息**：敏感信息（如 LINE Bot 的 `accessToken`）和環境相關配置（如數據庫 URI）直接硬編碼在代碼中，帶來安全風險，並使得在不同環境部署和維護變得困難。
4.  **業務邏輯與數據訪問層緊密混合**：在路由處理函數中，業務邏輯（如數據格式化、排序）與數據庫操作邏輯（直接調用 `mongodb` 驅動）緊密耦合，降低了代碼的內聚性、可測試性和可重用性。
5.  **`app.js` 職責過多**：主應用文件 `app.js` 中除了初始化應用、加載路由和中間件外，還包含了直接的數據庫操作邏輯（如 `/delete/:id` 路由），這使得 `app.js` 的職責不夠單一。

以下章節將針對這些問題提供詳細的改善建議。

## 詳細改善建議

## 改善建議

### 1. 統一數據庫連接管理

**問題描述：**
專案中存在多種數據庫連接的實現方式。在 `utils/db.js` 中，導出的是一個未連接的 `MongoClient` 實例。在 `utils/db2.js` 中，導出的是一個異步函數 `connectToDatabase`，它會連接數據庫並返回數據庫實例。此外，在 `app.js` 以及部分路由文件（例如 `managePrescriptions.js` 和 `managePrescriptions2.js`）中，存在直接創建 `MongoClient` 實例並進行連接和關閉的操作。這種不一致的數據庫連接管理方式導致了以下問題：

*   **代碼冗餘**：多處重複編寫數據庫連接和關閉的邏輯。
*   **維護困難**：如果數據庫連接信息（如 URI）需要修改，需要在多個地方進行更改，容易遺漏。
*   **資源管理風險**：手動管理連接的打開和關閉容易出錯，可能導致連接洩漏或未及時釋放資源。
*   **不一致性**：不同的連接方式可能導致行為上的細微差異，增加調試難度。

**改善建議：**
建議採用統一的數據庫連接管理模塊。可以基於 `utils/db2.js` 的思路進行改進，創建一個單例的數據庫連接池或一個能夠在應用程序啟動時建立連接並在需要時提供數據庫實例的模塊。

**具體步驟：**

1.  **選擇一個統一的連接策略**：推薦使用 `utils/db2.js` 中的 `connectToDatabase` 函數作為基礎，確保在應用程序生命週期內有效管理連接。
2.  **移除冗餘的連接代碼**：
    *   刪除 `utils/db.js` 文件。
    *   移除 `app.js` 中直接實例化 `MongoClient` 的代碼。
    *   修改所有路由文件，使其統一使用新的數據庫連接模塊，而不是自行創建連接或依賴舊的 `db.js`。
3.  **實現連接池（可選但推薦）**：對於高並發應用，考慮使用 `mongodb` 驅動程序內置的連接池功能，或者在數據庫模塊中進行封裝，以提高性能和資源利用率。
4.  **集中管理數據庫配置**：將數據庫 URI（例如 `mongodb://localhost:27017` 或 `mongodb://192.168.68.79:27017`）移至環境變量或配置文件中，而不是硬編碼在代碼裡。

**示例（簡化版）：**

```javascript
// utils/database.js
const { MongoClient } = require("mongodb");

// 從環境變量或配置文件讀取URI
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017"; 
const client = new MongoClient(uri);
let dbInstance = null;

async function connectToDatabase() {
    if (dbInstance) {
        return dbInstance;
    }
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB.");
        dbInstance = client.db("pharmacy"); // 指定數據庫名稱
        return dbInstance;
    } catch (error) {
        console.error("Could not connect to MongoDB", error);
        process.exit(1); // 連接失敗時退出應用
    }
}

// 應用程序關閉時斷開連接
process.on("SIGINT", async () => {
    if (client && client.topology && client.topology.isConnected()) {
        await client.close();
        console.log("MongoDB connection closed.");
    }
    process.exit(0);
});

module.exports = { connectToDatabase };
```

在路由文件中使用：

```javascript
const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../utils/database"); // 統一的數據庫模塊
const { ObjectId } = require("mongodb");

router.get("/", async (req, res) => {
    try {
        const db = await connectToDatabase();
        const items = await db.collection("yourCollection").find({}).toArray();
        res.json(items);
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
    }
    // 不需要手動 client.close()
});

module.exports = router;
```

### 2. 消除路由中的代碼重複

**問題描述：**
專案中的 `routes/managePrescriptions.js` 和 `routes/managePrescriptions2.js` 文件內容高度相似，幾乎是完全重複的。這兩個文件都處理獲取處方信息、查詢患者信息、格式化數據以及更新處方狀態（prei）和發送 LINE 通知等邏輯。主要的區別似乎僅在於最終渲染的視圖模板 (`manageprescription.ejs` vs `manageprescription2.ejs`) 以及數據排序邏輯上的一些細微差別。

這種大量的代碼重複會導致：

*   **維護成本增加**：當需要修改相關邏輯時（例如，LINE 通知的格式、數據庫查詢條件、錯誤處理），需要在多個地方進行相同的修改，容易遺漏且耗時。
*   **錯誤風險增高**：重複的代碼意味著重複的潛在錯誤點。修復一個文件中的錯誤後，很容易忘記在其他重複文件中進行同樣的修復。
*   **可讀性降低**：相似但不完全相同的代碼塊使得理解它們之間的真正差異變得困難。

**改善建議：**
對這些重複的路由邏輯進行重構，提取公共部分到可重用的函數或中間件中。

**具體步驟：**

1.  **識別公共邏輯**：仔細比較 `managePrescriptions.js` 和 `managePrescriptions2.js`，找出完全相同或高度相似的代碼塊。例如：
    *   數據庫連接和查詢處方及患者信息的邏輯。
    *   格式化處方數據的邏輯。
    *   更新 `prei` 狀態的 `/update_prei/:id` 路由處理邏輯。
    *   發送 LINE 通知的 `/send_message` 路由處理邏輯。
2.  **提取公共函數**：將這些公共邏輯提取到 `utils` 目錄下的新輔助函數模塊中，或者創建一個專門的服務層來處理這些業務邏輯。
    *   例如，可以創建一個 `prescriptionService.js`，包含獲取和格式化處方數據、更新處方狀態、發送通知等函數。
3.  **參數化差異部分**：對於兩個路由之間存在的細微差異（如排序邏輯或渲染的視圖名稱），可以通過函數參數或配置對象傳遞給公共函數。
4.  **簡化路由文件**：修改 `managePrescriptions.js` 和 `managePrescriptions2.js`，讓它們調用提取出來的公共函數，只保留各自獨特的邏輯（如果有的話）或傳遞不同的參數。
5.  **考慮合併路由**：如果兩個路由的核心功能和數據處理邏輯基本一致，僅僅是最終呈現或排序方式不同，可以考慮將它們合併為一個路由，通過查詢參數來控制不同的行為。

**示例（簡化思路）：**

```javascript
// utils/prescriptionService.js (假設的服務文件)
const { connectToDatabase } = require("./database");
const { ObjectId } = require("mongodb");
const axios = require("axios");
const accessToken = process.env.LINE_ACCESS_TOKEN; // 從環境變量讀取

async function getFormattedPrescriptions(pid, sortOptions) {
    const db = await connectToDatabase();
    const prescriptionsCollection = db.collection("prescriptions");
    const patientsCollection = db.collection("patients");
    // ... (省略獲取和格式化處方的詳細邏輯，與原代碼類似)
    // ... (根據 sortOptions 進行排序)
    return formattedAndSortedPrescriptions;
}

async function updatePreiStatus(prescriptionId, prei, check) {
    const db = await connectToDatabase();
    const prescriptionsCollection = db.collection("prescriptions");
    await prescriptionsCollection.updateOne(
        { _id: new ObjectId(prescriptionId) },
        { $set: { [check]: prei } }
    );
    return { success: true, prei };
}

async function sendLineNotification(payload) {
    // ... (省略 LINE 通知詳細邏輯，與原代碼類似)
    // 成功後更新數據庫狀態
    const db = await connectToDatabase();
    const prescriptionsCollection = db.collection("prescriptions");
    await prescriptionsCollection.updateOne(
        { _id: new ObjectId(payload.prescriptionId) },
        { $set: { [payload.check]: "0" } }
    );
    return { success: true, message: `${payload.panme} 推送通知成功，prei 已更新！` };
}

module.exports = { getFormattedPrescriptions, updatePreiStatus, sendLineNotification };
```

然後在路由文件中：

```javascript
// routes/managePrescriptions.js
const express = require("express");
const router = express.Router();
const prescriptionService = require("../utils/prescriptionService");

router.get("/", async (req, res) => {
    const pid = req.query.pid;
    try {
        // 假設 sortOptions 用於區分排序邏輯
        const prescriptions = await prescriptionService.getFormattedPrescriptions(pid, { sortBy: "value", order: "desc" }); 
        res.render("manageprescription", { prescriptions });
    } catch (error) {
        // ... 錯誤處理
    }
});

router.post("/update_prei/:id", async (req, res) => {
    // ... 調用 prescriptionService.updatePreiStatus
});

router.post("/send_message", async (req, res) => {
    // ... 調用 prescriptionService.sendLineNotification
});

module.exports = router;
```

`managePrescriptions2.js` 可以類似地重構，或者如果差異足夠小，可以考慮合併。

### 3. 外部化硬編碼的配置

**問題描述：**
專案中存在硬編碼的配置信息，最明顯的是在 `routes/managePrescriptions.js` 和 `routes/managePrescriptions2.js` 中的 LINE Bot `accessToken`：

```javascript
const accessToken = "exoanGGQhg1U2w5LDl4RJwHYAKezrU1MY9BUTTFuVVyu9srVXbJoV6HiF3t3Nm9q72myd6cHjsoSMqx3vf8D/M/J5PopwJFsgMJy3qYvoyG/icHwWVIUsZkbyWhUUyW0/CK4hVnqXR/Vjsa3IP8COAdB04t89/1O/w1cDnyilFU=";
```

此外，數據庫連接 URI (`mongodb://localhost:27017` 或 `mongodb://192.168.68.79:27017`) 也散佈在 `utils/db.js`、`utils/db2.js` 和 `app.js` 中。

硬編碼配置會導致：

*   **安全風險**：將敏感信息（如 API 令牌、密碼）直接寫入代碼庫，如果代碼庫被洩露，這些敏感信息也會隨之洩露。
*   **部署困難**：在不同的環境（開發、測試、生產）中部署時，通常需要不同的配置。硬編碼使得每次部署前都需要修改代碼。
*   **維護不便**：當配置需要更新時，需要在代碼中搜索並修改，容易出錯。

**改善建議：**
將所有環境相關的配置（如 API 密鑰、數據庫憑證、服務 URL 等）外部化，推薦使用環境變量或專門的配置文件。

**具體步驟：**

1.  **識別所有硬編碼的配置**：檢查整個代碼庫，找出所有類似 `accessToken` 和數據庫 URI 這樣的硬編碼值。
2.  **使用環境變量**：
    *   這是 Node.js 應用中常用的做法。可以在啟動應用程序時設置環境變量。
    *   在代碼中通過 `process.env.VARIABLE_NAME` 來訪問這些值。
    *   為了方便本地開發，可以使用 `.env` 文件和 `dotenv` 這樣的庫來加載環境變量。`.env` 文件本身不應提交到版本控制系統（應添加到 `.gitignore`）。
3.  **使用配置文件（可選）**：對於更複雜的配置結構，可以考慮使用 JSON 或 JavaScript 文件作為配置文件。這些配置文件也可以根據環境（如 `config.development.js`, `config.production.js`）進行組織。
4.  **更新代碼以讀取配置**：修改代碼，使其從環境變量或配置文件中讀取配置信息，而不是使用硬編碼的值。

**示例（使用環境變量和 `dotenv`）：**

1.  安裝 `dotenv`：`npm install dotenv`
2.  在專案根目錄創建 `.env` 文件（**不要提交到 Git**）：
    ```
    MONGODB_URI="mongodb://localhost:27017/pharmacy"
    LINE_ACCESS_TOKEN="your_line_bot_access_token_here"
    ```
3.  在應用程序入口文件（如 `app.js`）的頂部加載 `dotenv`：
    ```javascript
    require("dotenv").config();
    const express = require("express");
    // ... 其他代碼
    ```
4.  在需要配置的地方使用環境變量：
    ```javascript
    // utils/database.js (示例)
    const uri = process.env.MONGODB_URI;
    
    // routes/managePrescriptions.js (示例)
    const accessToken = process.env.LINE_ACCESS_TOKEN;
    ```

### 4. 分離業務邏輯與數據訪問層

**問題描述：**
在當前的路由處理函數中（例如 `managePrescriptions.js`），業務邏輯（如數據的格式化、排序、決定何時發送通知）與數據訪問邏輯（直接調用 `mongodb` 驅動進行數據庫查詢和更新）緊密地混合在一起。

例如，在 `managePrescriptions.js` 的 GET 請求處理器中：

```javascript
    // ...
    await client.connect(); // 數據庫連接
    const db = client.db("pharmacy");
    const prescriptionsCollection = db.collection("prescriptions");
    const patientsCollection = db.collection("patients");

    // 數據庫查詢
    const allPrescriptions = await prescriptionsCollection.find(query).toArray();

    // 業務邏輯：根據 pid 反查患者信息並格式化結果
    const formattedPrescriptions = await Promise.all(
        allPrescriptions.flatMap(async item => {
            const patient = await patientsCollection.findOne({ pid: item.pid });
            // ... 格式化邏輯 ...
            return rows;
        })
    );

    // 業務邏輯：分組和排序
    const groupedPrescriptions = formattedPrescriptions.flat().reduce((acc, item) => {
        // ... 分組邏輯 ...
    }, { beforeToday: [], afterToday: [] });
    groupedPrescriptions.beforeToday.sort((a, b) => b.value - a.value);
    groupedPrescriptions.afterToday.sort((a, b) => a.value - b.value);

    res.render("manageprescription", { prescriptions: groupedPrescriptions });
    // ...
    await client.close(); // 數據庫關閉
```

這種混合導致：

*   **低內聚性**：路由處理器承擔了過多的職責，既要處理 HTTP 請求和響應，又要執行複雜的業務計算和數據庫操作。
*   **高耦合性**：業務邏輯緊密依賴於特定的數據庫實現（MongoDB 的 API）。如果將來需要更換數據庫或數據訪問方式，將需要大量修改路由代碼。
*   **可測試性差**：難以單獨測試業務邏輯，因為它與數據庫操作和 Express 框架緊密耦合。
*   **可重用性低**：如果其他部分的應用程序需要類似的業務邏輯或數據訪問，很難重用這些混合在一起的代碼。

**改善建議：**
引入服務層（Service Layer）和/或數據訪問層（Data Access Layer, DAL，也常稱為 Repository Pattern）來分離關注點。

*   **數據訪問層 (DAL/Repository)**：負責封裝所有與數據庫的交互。它提供一組接口（例如 `findPrescriptions`, `getPatientById`, `updatePrescriptionStatus`），供服務層調用。DAL 內部處理數據庫連接、查詢、事務等細節，對上層隱藏數據庫的具體實現。
*   **服務層 (Service Layer)**：包含應用程序的業務邏輯。它協調數據訪問層的操作，執行業務規則、數據轉換、驗證等。服務層不直接與 HTTP 請求或響應打交道，也不直接操作數據庫。
*   **路由處理器 (Controller Layer)**：保持輕量，主要負責解析 HTTP 請求，調用服務層的方法，然後根據服務層返回的結果構建 HTTP 響應（例如渲染視圖或返回 JSON）。

**具體步驟：**

1.  **創建數據訪問模塊**：為每個數據實體（如 `Prescription`, `Patient`）創建一個 Repository 文件（例如 `prescriptionRepository.js`, `patientRepository.js`）。這些文件將包含所有與該實體相關的數據庫操作函數。
    ```javascript
    // repositories/prescriptionRepository.js
    const { connectToDatabase } = require("../utils/database");
    const { ObjectId } = require("mongodb");

    async function find(query) {
        const db = await connectToDatabase();
        return db.collection("prescriptions").find(query).toArray();
    }

    async function updateStatus(id, check, status) {
        const db = await connectToDatabase();
        return db.collection("prescriptions").updateOne({ _id: new ObjectId(id) }, { $set: { [check]: status } });
    }
    // ... 其他數據庫操作
    module.exports = { find, updateStatus };
    ```
2.  **創建服務模塊**：創建服務文件（例如 `prescriptionService.js`），它將使用 Repository 來獲取和操作數據，並實現業務邏輯。
    ```javascript
    // services/prescriptionService.js
    const prescriptionRepo = require("../repositories/prescriptionRepository");
    const patientRepo = require("../repositories/patientRepository"); // 假設有 patientRepository
    const lineService = require("./lineService"); // 假設有 lineService

    async function getManagedPrescriptions(pid, sortOptions) {
        const query = { /* ... 構建查詢條件 ... */ };
        if (pid) query.pid = pid;
        const prescriptions = await prescriptionRepo.find(query);
        const patients = await patientRepo.find({ pid: { $in: prescriptions.map(p => p.pid) } }); // 批量獲取患者
        
        // 業務邏輯：格式化、分組、排序
        const formatted = prescriptions.map(p => {
            const patient = patients.find(pt => pt.pid === p.pid);
            // ... 格式化邏輯 ...
            return { /* ... */ };
        });
        // ... 分組和排序邏輯 ...
        return groupedPrescriptions;
    }

    async function notifyAndClearPrescription(payload) {
        await lineService.sendNotification(payload.pline, payload.messageData);
        await prescriptionRepo.updateStatus(payload.prescriptionId, payload.check, "0");
        return { success: true, message: "通知成功並更新狀態" };
    }

    module.exports = { getManagedPrescriptions, notifyAndClearPrescription };
    ```
3.  **簡化路由處理器**：路由處理器現在只調用服務層的方法。
    ```javascript
    // routes/managePrescriptions.js
    const express = require("express");
    const router = express.Router();
    const prescriptionService = require("../services/prescriptionService");

    router.get("/", async (req, res) => {
        try {
            const pid = req.query.pid;
            const prescriptions = await prescriptionService.getManagedPrescriptions(pid, { /* sort options */ });
            res.render("manageprescription", { prescriptions });
        } catch (error) {
            console.error(error);
            res.status(500).send("Server Error");
        }
    });

    router.post("/send_message", async (req, res) => {
        try {
            const result = await prescriptionService.notifyAndClearPrescription(req.body);
            res.json(result);
        } catch (error) {
            // ...
        }
    });
    module.exports = router;
    ```

### 5. 其他潛在改進點

*   **錯誤處理**：當前的錯誤處理主要依賴 `console.error` 和發送 500 狀態碼。可以實現更一致和結構化的錯誤處理機制，例如自定義錯誤類、統一的錯誤處理中間件，以便向客戶端返回更友好的錯誤信息，並更好地記錄錯誤日誌。
*   **輸入驗證**：對來自客戶端的輸入（如請求參數、請求體）進行嚴格的驗證，以防止無效數據導致的錯誤或安全漏洞。可以使用 `express-validator` 等庫。
*   **日誌記錄**：除了錯誤日誌，還可以考慮添加更詳細的應用程序日誌，用於監控和調試。
*   **異步操作管理**：在 `flatMap` 中使用 `async item => {...}` 時，`Promise.all` 的使用是正確的。確保所有異步操作都得到妥善處理，避免未捕獲的 Promise 拒絕。
*   **前端與後端分離**：雖然目前使用的是 EJS 模板引擎，但長遠來看，如果前端邏輯變得複雜，可以考慮將前端完全分離（例如使用 React, Vue, Angular 等框架），後端僅提供 API。這可以進一步降低耦合。
*   **測試**：為關鍵的業務邏輯和數據訪問邏輯編寫單元測試和集成測試，以確保代碼質量和方便後續重構。
*   **LINE Bot 消息構建**：`bubbleMessage` 的構建邏輯也可以提取到一個專門的模塊或函數中，使路由代碼更簡潔。
*   **`app.js` 中的刪除邏輯**：`app.js` 中有一個 `/delete/:id` 的路由處理器，它也直接操作數據庫。這個邏輯也應該遵循與其他路由相同的模式，即通過服務層和數據庫訪問層來處理。

通過實施這些建議，專案的代碼將變得更加模塊化、可維護、可測試和可擴展，從而顯著降低耦合度。

