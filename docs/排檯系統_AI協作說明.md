# 排檯系統 AI 協作說明（給 ChatGPT／Gemini）

你是協助我（冠廷）開發酒店副業「排檯／店務系統」的 AI。請用台灣繁體中文回答，簡短直接。

## 一、系統位置
- 程式碼：GitHub `tk90337-giottohank/paitai-demo`（main 分支），程式在 `v12/` 資料夾
- 網站（GitHub Pages）：
  - 主程式：https://tk90337-giottohank.github.io/paitai-demo/v12/
  - 小姐報班頁：https://tk90337-giottohank.github.io/paitai-demo/v12/girl/
  - 客人點檯頁：https://tk90337-giottohank.github.io/paitai-demo/v12/guest.html
- 資料庫：Firebase 專案 `paitai-system`（Spark 免費方案，Firestore 在 asia-east1，沒有 Cloud Functions，所有邏輯都在前端＋Firestore 規則）
- 目前版本：v12.28（傳統排檯表照片自動辨識＋雲端備份；登入維持 v12.27.1 彈窗優先）

## 二、技術架構
純前端 HTML／JavaScript（無框架、無打包），Firebase Auth＋Firestore 即時同步。主要檔案：
- `index.html`：主程式畫面
- `nav.js`：五大選單（排檯、小姐報班／排班、少爺公主・酒水、點餐・廚房、報表）＋右上齒輪（設定／帳號）
- `cloud.js`：Firestore 讀寫、登入、權限
- `app.js`、`grid.js`：排檯看板與包廂
- `dayroll.js`：換日（07:10）、補跑、包廂重設、昨日待辦
- `import-sheet.js`：傳統排檯表拍照匯入（Gemini 辨識）
- `att.js`：少爺／公主打卡定位、排班、薪資
- `guest.html`、`guest.js`：客人點檯頁（QR 掃碼，免登入）
- `girl/`：小姐報班頁
- `i18n.js`、`i18n-data.js`：中越雙語
- `firestore.rules`：資料庫權限規則

## 三、店家設定
- 包廂 8 間：101、102、103、105、106、201、202、203
- 每天 07:10 換日：上一天存檔，還沒買單的包廂存進前一天的紀錄和「昨日待辦」後從看板清掉（不刪歷史、不改帳單）；任一已登入裝置在 07:10 後打開都會補跑漏掉的日子
- 一般小姐約 50 位，用「編號」辨識，改名跟著編號走，歷史台數不變

## 四、業務規則（不要擅自改）
1. 點檯燈號：沒報班或請假就不顯示；同時在 3 間包廂（可在設定改）才算「已滿」變灰；保檯和私檯都算進 3 間；在 1～2 間仍亮燈可點。
2. 私檯在 X 包廂：其他包廂不能點她，X 包廂可以。
3. 幹部可對個別小姐設「暫停點檯」或「開放點檯」，優先於規則，並留紀錄。
4. 隨機點檯只抽亮燈的小姐。
5. 小姐在報班頁報班後，自動加入當天排檯名單；匯入某日排檯表也會自動幫表上的小姐加入該營業日報班（現場在檯狀態只在匯入「今天」時更新）。
6. 排檯表照片辨識：先認編號對名單，再用中文名字交叉核對；對不上的標黃給人確認。
7. 日報、排檯表、日結、報表要分開顯示「番數」和「小姐台數合計」兩個總數。
8. 客人 QR：每個 QR 有效 2 小時，結帳就失效；續番時仍有效，並提醒客人可以換小姐或續原本的小姐。
9. 自動排台只給建議，不自動派檯。
10. 重設包廂要先確認，並把資料存檔，不能直接刪除。
11. 權限分級（數字）：小姐／少爺＝1、幹部＝2、經理＝3、店長＝4、老闆＝5、冠廷（內部角色名「特殊」，畫面只顯示「冠廷」）＝6。幹部以上才能改小姐名字和改權限，而且只能改／指派比自己低階的人。店長擁有經理的全部能力，並可管理經理及以下。建立帳號仍是老闆以上。冠廷的帳號只有冠廷本人能改。
12. 系統只處理出勤、排班、點檯和結帳，不做任何限制人員離開或監控私人行動的功能。

## 五、介面規則
- 全部介面中越雙語：繁體中文在第一行，較小的越南文在下一行（不要寫成「中 / Việt」同一行）；圖示只出現一次；按鈕之間要留寬鬆的間距。
- 客人點檯頁提供中文、越南文、英文、泰文四種語言。
- 畫面要清爽簡潔，iPhone 和安卓手機都要能正常使用。
- 冠廷的帳號只顯示「冠廷」，任何地方都不能出現「特殊」。
- 全部用台灣繁體中文用語，不要用大陸用語。

## 六、修改規則
1. 改之前先拉最新版（git pull），改完更新版本號（例如 v12.24）、commit、push。
2. 動資料庫資料前先備份；已存的帳單金額一律不能改。
3. 不要把任何密碼、金鑰貼在對話或程式碼裡；`firebase-config.js` 的 Web 設定除外，那本來就是公開的。
4. 改 `firestore.rules` 時，權限要在規則裡真的擋住，不能只靠畫面隱藏。
5. 還有其他 AI 也在改同一份程式，大改前先告訴冠廷，避免互相蓋掉。

## 七、v12.25 匯入傳統排檯表與校對
- 入口（僅幹部以上看得到、規則也擋寫入）：
  - 主選單「排檯」→「匯入傳統排檯表」（拍照／相簿／CSV／xlsx，確認前先核對）
  - 主選單「排檯」或「報表」→「匯入校對」
  - 「今日排檯表」「傳統排檯表」標題旁也有同樣按鈕；舊的「手動匯入」（文字／格子）仍保留在「排檯」
- 辨識規則不變：先讀小姐編號對名冊，中文名字只做交叉核對，不符或號碼不清就黃框待審。
- 每次確認寫入後，會在 Firestore `importArchive` 存一筆備份：營業日、誰在何時匯入、原始檔／照片引用（`sheetImports`）、原始辨識列、人工改過後的最終列、差異／不符清單。既有帳單與金額不會被覆寫或刪除。
- 校對檢視：打開過去匯入，原圖與已存資料並排（手機直式會上下排列），可把列標「已校對」、下載 JSON／CSV。備份紀錄不可刪，校對只能改校對欄位。
- 部署前要把 `days`／`hist` 備份到工作目錄 `import/日期-import/`，並核對帳單欄雜湊未變。

## 八、v12.25 包廂平板登出、店長職級
- 包廂客人頁右上角 🔒 會打開員工面板（主畫面其他按鈕不變）：
  - 「登出」：必須輸入該包廂平板自己的密碼，系統用 Firebase 再驗證目前這個房間帳號（不在程式裡比對或存放明文密碼）。密碼錯誤會提示並保持登入；正確才登出，回到包廂平板登入畫面，並提供連到排檯主程式登入頁的連結。
  - 「員工解鎖」：需幹部以上，可用員工編號＋密碼，或 Google 登入。解鎖後可重新整理或解除綁定。
- 主程式、小姐報班頁、等候核准／已停用畫面都有可按的登出（一般確認即可）。
- 職級對照：小姐／少爺 1 ＜ 幹部 2 ＜ 經理 3 ＜ **店長 4** ＜ **老闆 5** ＜ **冠廷 6**。店長在經理之上、老闆之下。已把舊的老闆 rank 4→5、冠廷 rank 5→6 遷移，規則與下拉選單已同步。

## 九、v12.26 三個頁面登入分開
- 主程式（`v12/`）、小姐報班頁（`v12/girl/`）、包廂客人頁（`v12/guest.html`）各用獨立的 Firebase Auth 工作階段（具名 app：`staff`、`girl`、`room`）。同一個手機瀏覽器可以一邊用房間平板登入包廂頁，一邊用員工帳號登入主程式，互不覆蓋、也不會自動跳轉到另一頁。
- 若在主程式或報班頁登入了房間平板帳號（或在包廂頁登入了員工帳號），只顯示說明與連結，不會 `location.replace` 把人帶走。
- 升級後舊的共用登入不會自動套到新分頁；各頁需要各登入一次。主程式／報班頁若還偵測到舊的預設工作階段是房間平板，會把它清掉，避免再把主程式綁去包廂頁。
- 客人 QR（免登入）與包廂頁鎖頭（包廂密碼登出、員工解鎖）維持不變。

## 十、v12.27 iPhone Google 登入修正
- 主程式與小姐報班頁：具名 Firebase app 用 `initializeAuth` 一次設好 persistence 與 `browserPopupRedirectResolver`，回來後先等 `getRedirectResult`／`authStateReady` 再決定要不要顯示登入頁。
- 不要在載入時新建 `[DEFAULT]` app（舊的「清房間平板 session」只在本機已經有預設 app 時才跑），也不要在 redirect 途中再呼叫 `setPersistence`，以免 iOS 把 Google 登入結果清掉後跳回登入頁。
- iPhone／iPad 一般瀏覽器改先用 Google 彈窗（使用者點擊觸發）；加到主畫面的 App 仍走 redirect。若應與 kt 合併的 Google 帳號被登出，錯誤說明會留在登入頁，不會一閃而過。
- 包廂客人頁本身不用 Google 登入；鎖頭「員工解鎖」仍用彈窗（臨時 app），不受主程式 session 影響。

## 十一、v12.27.1 主畫面 App Google 登入
- v12.27 在一般 iPhone 瀏覽器已改走 Google 彈窗，但「加入主畫面」的獨立 App（standalone）仍走 `signInWithRedirect`。GitHub Pages 無法代理 `/__/auth`，iOS 主畫面 App 的 storage 與 Safari 分開，redirect 回來時常丟失結果，看起來就像選完帳號又回到登入頁，且沒有錯誤文字。
- v12.27.1：主畫面 App 也先走 `signInWithPopup`（iOS 16.4+ 支援），只有彈窗被擋才退回 redirect；若 redirect 回來沒有使用者，登入頁會顯示「redirect-lost」說明。任何 Google 失敗都會顯示錯誤代碼，並寫入 `loginFails`。登入頁下方顯示版本號（例如 v12.27.1）。
- 主畫面 App 若仍快取舊版（沒有版本號），需刪掉圖示、用 Safari 打開新頁再重新加入主畫面。

## 十二、v12.28 傳統排檯表自動辨識與雲端備份
- 店長／幹部以上在主程式匯入傳統排檯表照片後，瀏覽器會用 Firebase AI Logic（Gemini Developer API、`gemini-flash-latest`、結構化 JSON）自動辨識，通常數秒內把草稿填進核對表。規則不變：先讀小姐編號對名冊，中文名字只做交叉核對，不符或號碼不清就黃框。確認寫入前不會改當日資料或帳單。
- 原始 AI 結果與 model 名稱會存進 `importArchive`，供匯入校對。
- Spark 沒有 Cloud Functions；辨識在已登入的幹部瀏覽器進行，不把 API key 寫進公開 repo。若瀏覽器辨識失敗，仍會把照片上傳到 Firestore `sheetImports`（分塊），可走既有佇列＋box 上的 `tools/sheet-photo-worker.py` 後備。
- 每次上傳都會把壓縮後的照片與辨識 JSON 備份在 Firestore。另外用 `tools/sync-sheet-backups-to-drive.py` 定期同步到 Google Drive「排檯表匯入備份」（依營業日分子資料夾）。不依賴 Firebase Storage，不必在 Console 點 Get Started。
- Google 登入維持 v12.27.1：主畫面 App 也先走彈窗、失敗顯示錯誤與版本號、寫入 `loginFails`。

### 多日匯入（冠廷 2026-11-24 01:16）

店長／幹部可一次選很多張照片或 CSV（含同一天的多頁）。系統會自動辨識每張（或同一天的多頁合併辨識），從紙本讀出營業日（可改；看不清或與檔名不符會黃框），並依日期分組。核對畫面用分頁列出各日與狀態，可「確認寫入（此日）」、「略過此日」或「全部確認寫入」。每一天分開寫入 importArchive，並分開排進雲端備份（Firestore sheetImports，再同步到 Drive「排檯表匯入備份」）。寫入時把紙本上的小姐自動加入該日報班（既有 `sheetImportCheckin`）。**絕不改帳單金額**（含已日結日的 `revenue`／`voidedRevenue`／`staffPay`）。若該日已有資料，必須明確選「合併」或「略過」才會寫入；全部確認時對已有資料的日子預設合併並再問一次。辨識與全部寫入過程有進度條。確認前不改當日資料。登入行為維持 v12.27.1（一律先 popup，含主畫面 App；失敗顯示錯誤與版本；loginFails）。

### 2026-11-24 清空營業資料（讓店長重新上傳）

授權：冠廷「先取消全部資料 讓店長重新上傳」；範圍為全部營業資料清掉，帳號與小姐名單保留。

完整 Firestore 備份（含將清除與保留的集合，可還原）在：

`/workspace/hostess-club-system/import/2026-11-24-wipe/`

- `backup-meta.json`：時間、集合、文件數、checksum
- `firestore-dump/`：各集合文件
- `firestore-wipe-toolkit.py --restore`：還原（可加 `--restore-collections=...`）
- `wipe-report.json`：清除後對照

已清除：days（今日改寫成空看板並保留小姐／少爺名冊）、hist、guestTokens、punches、public 等營業資料。當時不存在、故無文件可刪的集合：sheetImports、importArchive、orders、girlCheckin、girlHist、leaves、wine、wineLog、ledger、loginFails、guestReq。

已保留：users、config（settings／roster／boot）、permLog、loginFails（空）、loginLogs、secrets、menu、audit（操作紀錄，不確定是否算營業資料故保留）。Google Drive「排檯表匯入備份」未刪。線上版本 v12.28.1（cleanVer=3；空資料也可開排檯／報表／匯入）。
