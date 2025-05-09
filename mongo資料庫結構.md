
## mongodb 資料庫內容
/pharmacy # database
│
├── /medications # 藥品資訊collection
│    ├── did # 藥品編號
│    ├── dname # 藥品名稱
│    ├── dinsuranceCode # 藥品健保碼
│    ├── dcost # 藥品成本
│    ├── dincome # 藥品健保給付價
│    └── dmanufacturer # 藥品製造商
│
├── /patients  # 病人資訊collection
│    ├── pname # 病人姓名
│    ├── pid# 病人身分證
│    ├── pdate # 病人生日
│    ├── pvip # 會員資格
│    ├── pline # 會員聊天室line
│    └── pphone # 病人電話
│
├── /prescriptions  # 處方資訊collection
│    ├── pid # 病人身分證
│    ├── presec # 處方分秒
│    ├── predate # 處方日期
│    ├── prem # 處方狀態
│    ├── preexp # 處方期限
│    └── /drug # 藥品編號
│         ├── dinsuranceCode # 藥品健保碼
│         ├── dcount # 藥品數量
│         └── df # 藥品頻率
│
├── /tests  # 檢驗項目collection
│    ├── tname # 檢驗名稱
│    ├── tinsuranceCode # 檢驗健保碼
│    ├── tcost # 檢驗成本
│    └── tincome # 檢驗健保給付價
│
├── /reports # 檢驗報告collection
│    ├── pid # 病人身分證
│    ├── rdate # 檢驗日期
│    └── /test # 檢驗項目
│         ├── tinsuranceCode # 檢驗健保碼
│         └──  tvalue # 檢驗數值
│
├── /inventory # 進銷存collection
│    ├── /purchaseOrders # 進貨單
│    │    ├── poid # 進貨單編號
│    │    ├── podate # 進貨日期
│    │    ├── pobill # 發票
│    │    ├── pobilldate # 發票日期
│    │    ├── posupplier # 供應商
│    │    ├── /items # 進貨項目
│    │    │    ├── did # 藥品編號
│    │    │    ├── quantity # 進貨數量
│    │    │    ├── unitCost # 單位成本
│    │    │    └── batchNumber # 批號
│    │    │
│    │    └── totalCost # 總成本
│    │
│    ├── /salesOrders # 銷貨單
│    │    ├── soid # 銷貨單編號
│    │    ├── sodate # 銷售日期
│    │    ├── sopatientID # 病人身分證（可選）
│    │    ├── /items # 銷售項目
│    │    │    ├── did # 藥品編號
│    │    │    ├── quantity # 銷售數量
│    │    │    ├── unitPrice # 單位售價
│    │    │    └── insuranceCode # 健保碼（可選）
│    │    └── totalIncome # 總收入
│    │
│    ├── /adjustmentOrders # 調整單
│    │    ├── aoid # 調整單編號
│    │    ├── aodate # 調整日期
│    │    ├── reason # 調整原因（例如：過期、損壞、盤點差異）
│    │    └── /items # 調整項目
│    │         ├── did # 藥品編號
│    │         ├── quantity # 調整數量
│    │         ├── adjustmentType # 調整類型（例如：增加或減少）
│    │         └── note # 備註
│    │
│    ├── /returnOrders # 退貨單
│    │    ├── roid # 退貨單編號
│    │    ├── rodate # 退貨日期
│    │    ├── supplier # 退貨供應商（如果是進貨退貨）
│    │    ├── patientID # 病人身分證（如果是病人退藥）
│    │    ├── /items # 退貨項目
│    │         ├── did # 藥品編號
│    │         ├── quantity # 退貨數量
│    │         ├── reason # 退貨原因（例如：過期、損壞）
│    │         └── batchNumber # 批號（可選）
│    │
│    ├── /shipmentOrders # 出貨單
│          ├── shoid # 出貨單編號
│          ├── shodate # 出貨日期
│          ├── shosupplier # 出貨供應商
│          └── /items # 出貨項目
│               ├── did # 藥品編號
│               ├── quantity # 出貨數量
│               └── note # 出貨備註





## medications 藥品資訊
- did
- dname
- dinsuranceCode
- dcost
- dincome
- dmanufacturer

## patients 病患資訊
- pname
- pid
- pdate
- pphone

### prescriptions 處方資訊
- pid
- presec
- predate
- drug
	- dname
	- dinsuranceCode
	- dcount
	- df
### tests 檢驗項目
- tname
- tinsuranceCode
- tcost
- tincome

### reports 檢驗報告
- pid
- rdate
- test
	-  tinsuranceCode
	- tvalue




node js
## app.js
## views
	- index.ejs
	- medicationResult.ejs
	- medicationResultByDate.ejs
	- result.ejs
	