// Reference data for registered HTTP status codes (IANA registry, RFC 9110 and friends).
// Each entry: code, official name, then "zh-TW ¦ en ¦ ja ¦ ko" for the meaning and for
// "when to use / common cause". Kept inline so the tool needs no locale keys per code.

export type Lang = 'zh-TW' | 'en' | 'ja' | 'ko'
export const LANGS: readonly Lang[] = ['zh-TW', 'en', 'ja', 'ko']
export type StatusClass = 1 | 2 | 3 | 4 | 5

export interface HttpStatus {
  code: number
  name: string
  cls: StatusClass
  meaning: Record<Lang, string>
  when: Record<Lang, string>
}

// [code, name, meaning(4 langs), when(4 langs)]
const RAW: Array<[number, string, string, string]> = [
  [100, 'Continue', '繼續，請接著傳送請求本文 ¦ Initial part received; the client should continue sending the body ¦ 最初の部分を受理。続けて本文を送ってよい ¦ 요청 앞부분을 받았으니 본문을 계속 보내도 됨', '客戶端送出 Expect: 100-continue 先確認伺服器願意接收大型上傳 ¦ Client sent Expect: 100-continue before a large upload ¦ 大きなアップロード前に Expect: 100-continue を送ったとき ¦ 큰 업로드 전에 Expect: 100-continue를 보냈을 때'],
  [101, 'Switching Protocols', '同意切換通訊協定 ¦ Server agrees to switch protocols ¦ プロトコルの切り替えに同意 ¦ 프로토콜 전환에 동의', 'WebSocket 或 HTTP/2 升級握手成功 ¦ Successful WebSocket / Upgrade handshake ¦ WebSocket などのアップグレード成功時 ¦ WebSocket 등 업그레이드 핸드셰이크 성공'],
  [102, 'Processing', '伺服器仍在處理（WebDAV，已棄用） ¦ Server is still processing (WebDAV, obsolete) ¦ サーバーは処理中（WebDAV、廃止） ¦ 서버가 처리 중(WebDAV, 폐기됨)', '長時間的 WebDAV 操作，避免客戶端逾時 ¦ Long WebDAV operations, to avoid client timeouts ¦ 長時間の WebDAV 操作でタイムアウトを防ぐ ¦ 오래 걸리는 WebDAV 작업의 타임아웃 방지'],
  [103, 'Early Hints', '提前提示，可先預載資源 ¦ Early hints so the browser can preload resources ¦ 先行ヒント。リソースを事前読み込みできる ¦ 브라우저가 리소스를 미리 받도록 하는 초기 힌트', '最終回應前先送 Link: rel=preload，加速頁面載入 ¦ Send Link: rel=preload headers before the final response to speed up page loads ¦ 最終応答前に Link: rel=preload を送り表示を高速化 ¦ 최종 응답 전에 Link: rel=preload를 보내 로딩 속도 향상'],
  [200, 'OK', '成功 ¦ The request succeeded ¦ リクエスト成功 ¦ 요청 성공', 'GET 回傳資源、POST/PUT 回傳處理結果 ¦ Normal response to GET, or the result of POST/PUT ¦ GET の通常応答や POST/PUT の結果 ¦ GET의 일반 응답 또는 POST/PUT 결과'],
  [201, 'Created', '已建立新資源 ¦ A new resource was created ¦ 新しいリソースを作成した ¦ 새 리소스가 생성됨', 'POST/PUT 建立成功，應附 Location 標頭指向新資源 ¦ Successful POST/PUT creation; include a Location header ¦ POST/PUT で作成成功。Location ヘッダーを付ける ¦ POST/PUT으로 생성 성공, Location 헤더 포함'],
  [202, 'Accepted', '已接受但尚未處理完成 ¦ Accepted for processing, not finished yet ¦ 受理したが処理は未完了 ¦ 접수했으나 아직 처리 완료 아님', '非同步任務／佇列，之後再查詢結果 ¦ Async jobs and queues; client polls for the result later ¦ 非同期ジョブ。結果は後で確認 ¦ 비동기 작업, 나중에 결과를 조회'],
  [203, 'Non-Authoritative Information', '內容來自代理或副本，非原始伺服器 ¦ Content was modified by a proxy, not the origin ¦ プロキシ経由で内容が変更されている ¦ 프록시가 원본 응답을 변경함', '轉換型代理修改了原始回應 ¦ A transforming proxy altered the origin response ¦ 変換プロキシが元の応答を加工した ¦ 변환 프록시가 원본 응답을 수정'],
  [204, 'No Content', '成功但沒有回應本文 ¦ Success with no response body ¦ 成功したが本文なし ¦ 성공했으나 응답 본문 없음', 'DELETE 成功或 PUT/PATCH 不需回傳內容 ¦ Successful DELETE, or PUT/PATCH that returns nothing ¦ DELETE 成功や本文不要の PUT/PATCH ¦ DELETE 성공 또는 본문이 필요 없는 PUT/PATCH'],
  [205, 'Reset Content', '請客戶端重設檢視（如清空表單） ¦ Client should reset the document view (e.g. clear the form) ¦ クライアントは表示（フォームなど）をリセットする ¦ 클라이언트가 화면(폼 등)을 초기화해야 함', '表單送出後要清空輸入欄位 ¦ After a form submission, clear the input fields ¦ フォーム送信後に入力欄を消したいとき ¦ 폼 제출 후 입력란을 비울 때'],
  [206, 'Partial Content', '只回傳請求的部分範圍 ¦ Only the requested byte range is returned ¦ 要求された範囲の一部のみ返す ¦ 요청한 범위의 일부만 반환', '影音串流、斷點續傳（Range 請求） ¦ Video streaming and resumable downloads (Range requests) ¦ 動画ストリーミングや再開可能なダウンロード（Range） ¦ 영상 스트리밍, 이어받기(Range 요청)'],
  [207, 'Multi-Status', '一次回報多個子請求的狀態（WebDAV） ¦ Status of several sub-operations in one body (WebDAV) ¦ 複数の結果を 1 つの本文で返す（WebDAV） ¦ 여러 하위 작업의 상태를 한 번에 반환(WebDAV)', '批次操作，每個項目有各自的狀態碼 ¦ Batch operations where each item has its own status ¦ 各項目が個別ステータスを持つ一括処理 ¦ 항목마다 상태가 다른 일괄 작업'],
  [208, 'Already Reported', '成員已在先前回應中列出（WebDAV） ¦ Members already listed in a previous reply (WebDAV) ¦ 既に前の応答で列挙済み（WebDAV） ¦ 이미 앞선 응답에 나열됨(WebDAV)', '避免 WebDAV 綁定重複列舉同一資源 ¦ Avoids listing the same bound resource twice in WebDAV ¦ WebDAV で同じリソースの重複列挙を避ける ¦ WebDAV에서 같은 리소스 중복 나열 방지'],
  [226, 'IM Used', '回應是對現有資源套用差異（delta）的結果 ¦ Response is the result of instance manipulations (delta encoding) ¦ インスタンス操作（差分）の結果を返している ¦ 인스턴스 조작(델타 인코딩) 결과를 반환', '搭配 A-IM 標頭的差異傳輸，極少使用 ¦ Delta encoding with the A-IM header; rarely used ¦ A-IM ヘッダーによる差分転送。ほぼ使われない ¦ A-IM 헤더 기반 델타 전송, 거의 쓰이지 않음'],
  [300, 'Multiple Choices', '有多個可選的表示方式 ¦ Several representations are available ¦ 複数の選択肢がある ¦ 선택 가능한 표현이 여러 개', '內容協商無法決定時列出選項，實務上少見 ¦ Content negotiation could not pick one; rare in practice ¦ コンテンツネゴシエーションで決まらないとき。実務では稀 ¦ 콘텐츠 협상으로 결정 못 할 때, 실무에서는 드묾'],
  [301, 'Moved Permanently', '資源已永久搬移到新網址 ¦ Resource moved permanently to a new URL ¦ リソースは恆久的に移動した ¦ 리소스가 영구적으로 이동', '網站改版或 HTTP 轉 HTTPS，搜尋引擎會更新索引 ¦ Site migration or HTTP to HTTPS; search engines update their index ¦ サイト移転や HTTPS 化。検索エンジンが索引を更新 ¦ 사이트 이전이나 HTTPS 전환, 검색엔진이 색인 갱신'],
  [302, 'Found', '暫時轉址到另一個網址 ¦ Temporary redirect to another URL ¦ 一時的に別 URL へ転送 ¦ 다른 URL로 임시 이동', '登入後導回、A/B 測試；方法可能被改成 GET ¦ Post-login redirects, A/B tests; clients may switch the method to GET ¦ ログイン後の転送など。メソッドが GET に変わることがある ¦ 로그인 후 이동 등, 메서드가 GET으로 바뀔 수 있음'],
  [303, 'See Other', '請改用 GET 到另一個網址取得結果 ¦ Fetch the result with GET at another URL ¦ 別 URL に GET で取得し直す ¦ 다른 URL로 GET 요청해서 결과를 받음', 'POST 處理完成後導向結果頁（PRG 模式） ¦ Redirect after POST to a result page (Post/Redirect/Get) ¦ POST 後に結果ページへ転送（PRG パターン） ¦ POST 처리 후 결과 페이지로 이동(PRG 패턴)'],
  [304, 'Not Modified', '資源沒變動，使用快取即可 ¦ Not modified; use the cached copy ¦ 更新なし。キャッシュを使う ¦ 변경 없음, 캐시 사용', '條件式請求（If-None-Match / If-Modified-Since）命中 ¦ A conditional request (If-None-Match / If-Modified-Since) matched ¦ 条件付きリクエストが一致したとき ¦ 조건부 요청(If-None-Match 등)이 일치할 때'],
  [305, 'Use Proxy', '須透過指定代理存取（已棄用） ¦ Must be accessed through a proxy (deprecated) ¦ プロキシ経由で要アクセス（非推奨） ¦ 지정한 프록시로 접근해야 함(폐기)', '因安全疑慮已棄用，不應再使用 ¦ Deprecated for security reasons; do not use ¦ セキュリティ上の理由で非推奨。使わない ¦ 보안 문제로 폐기, 사용하지 말 것'],
  [307, 'Temporary Redirect', '暫時轉址，且必須沿用原方法與本文 ¦ Temporary redirect that keeps method and body ¦ 一時転送。メソッドと本文を維持 ¦ 임시 이동, 메서드와 본문 유지', 'POST/PUT 需要暫時轉到別處而不被改成 GET ¦ Redirect a POST/PUT elsewhere without it turning into GET ¦ POST/PUT を GET に変えずに一時転送 ¦ POST/PUT을 GET으로 바꾸지 않고 임시 이동'],
  [308, 'Permanent Redirect', '永久轉址，且必須沿用原方法與本文 ¦ Permanent redirect that keeps method and body ¦ 恒久転送。メソッドと本文を維持 ¦ 영구 이동, 메서드와 본문 유지', 'API 端點永久搬家，POST 請求也要保持不變 ¦ Moving an API endpoint for good while keeping POST intact ¦ API の恒久移転で POST も維持したいとき ¦ API 엔드포인트를 영구 이전하면서 POST 유지'],
  [400, 'Bad Request', '請求格式錯誤，伺服器無法理解 ¦ Malformed request the server cannot understand ¦ リクエストが不正で理解できない ¦ 잘못된 요청 형식', 'JSON 語法錯誤、缺少必要參數、標頭不合法 ¦ Invalid JSON, missing parameters, bad headers ¦ JSON 構文エラー、必須パラメーター不足、不正ヘッダー ¦ JSON 문법 오류, 필수 파라미터 누락, 잘못된 헤더'],
  [401, 'Unauthorized', '尚未通過身分驗證 ¦ Authentication is required or failed ¦ 認証が必要、または失敗 ¦ 인증이 필요하거나 실패', '缺少或過期的 Token／帳密，應附 WWW-Authenticate ¦ Missing or expired token/credentials; send WWW-Authenticate ¦ トークン未指定や期限切れ。WWW-Authenticate を返す ¦ 토큰 누락·만료, WWW-Authenticate 헤더 포함'],
  [402, 'Payment Required', '需要付費（保留給未來使用） ¦ Payment required (reserved for future use) ¦ 支払いが必要（将来用に予約） ¦ 결제 필요(향후 사용을 위해 예약)', '部分 API 用於額度用盡或未訂閱 ¦ Some APIs use it for exhausted quota or missing subscription ¦ 一部の API でクォータ超過や未契約を示す ¦ 일부 API에서 할당량 초과·미구독 시 사용'],
  [403, 'Forbidden', '已驗證但沒有權限 ¦ Understood, but you are not allowed ¦ 認証済みだが権限がない ¦ 인증됐지만 권한 없음', '權限不足、IP 被封鎖、目錄禁止列出 ¦ Insufficient permissions, blocked IP, directory listing disabled ¦ 権限不足、IP ブロック、ディレクトリ一覧禁止 ¦ 권한 부족, IP 차단, 디렉터리 목록 금지'],
  [404, 'Not Found', '找不到資源 ¦ The resource does not exist ¦ リソースが見つからない ¦ 리소스를 찾을 수 없음', '網址打錯、資源已刪除；也可刻意隱藏無權存取的資源 ¦ Typo in the URL or deleted resource; can also hide forbidden ones ¦ URL の誤りや削除済み。アクセス不可のリソースを隠す用途も ¦ URL 오타, 삭제된 리소스, 권한 없는 리소스 숨김'],
  [405, 'Method Not Allowed', '此網址不支援該 HTTP 方法 ¦ The HTTP method is not supported for this URL ¦ この URL ではそのメソッドは使えない ¦ 이 URL에서 해당 HTTP 메서드를 지원하지 않음', '對唯讀端點送 POST；應附 Allow 標頭列出可用方法 ¦ POST to a read-only endpoint; send an Allow header ¦ 読み取り専用に POST など。Allow ヘッダーを返す ¦ 읽기 전용 엔드포인트에 POST, Allow 헤더 포함'],
  [406, 'Not Acceptable', '無法提供客戶端 Accept 要求的格式 ¦ Cannot produce a representation matching Accept headers ¦ Accept に合う形式を提供できない ¦ Accept 헤더에 맞는 형식을 제공할 수 없음', '客戶端只接受 XML 而伺服器只有 JSON ¦ Client accepts only XML but the server has only JSON ¦ クライアントは XML のみ許容、サーバーは JSON のみ ¦ 클라이언트는 XML만, 서버는 JSON만 제공'],
  [407, 'Proxy Authentication Required', '須先通過代理伺服器驗證 ¦ Authenticate with the proxy first ¦ 先にプロキシ認証が必要 ¦ 먼저 프록시 인증이 필요', '企業代理需要帳密（Proxy-Authenticate） ¦ A corporate proxy needs credentials (Proxy-Authenticate) ¦ 社内プロキシが認証を要求（Proxy-Authenticate） ¦ 사내 프록시가 인증 요구(Proxy-Authenticate)'],
  [408, 'Request Timeout', '伺服器等不到完整請求而逾時 ¦ Server timed out waiting for the full request ¦ リクエスト完了を待ってタイムアウト ¦ 요청을 다 받기 전에 서버가 타임아웃', '網路太慢或連線閒置過久；客戶端可重送 ¦ Slow network or idle connection; the client may retry ¦ 回線が遅い、接続が長時間アイドル。再送可 ¦ 느린 네트워크·유휴 연결, 재시도 가능'],
  [409, 'Conflict', '與資源目前狀態衝突 ¦ Conflicts with the current state of the resource ¦ リソースの現在の状態と競合 ¦ 리소스의 현재 상태와 충돌', '版本衝突、重複建立、編輯被他人先修改 ¦ Version conflict, duplicate create, concurrent edit ¦ バージョン競合、重複作成、同時編集 ¦ 버전 충돌, 중복 생성, 동시 편집'],
  [410, 'Gone', '資源已被永久移除 ¦ The resource is permanently gone ¦ リソースは恒久的に削除された ¦ 리소스가 영구 삭제됨', '比 404 更明確，告訴搜尋引擎可移除索引 ¦ Stronger than 404; tells crawlers to drop the URL ¦ 404 より明確。検索エンジンに削除を伝える ¦ 404보다 명확, 크롤러에게 색인 제거를 알림'],
  [411, 'Length Required', '需要 Content-Length 標頭 ¦ Content-Length header is required ¦ Content-Length ヘッダーが必要 ¦ Content-Length 헤더 필요', '伺服器不接受未宣告長度的本文 ¦ The server refuses bodies without a declared length ¦ 長さ未指定の本文を受け付けない ¦ 길이를 선언하지 않은 본문을 거부'],
  [412, 'Precondition Failed', '前置條件（If-Match 等）不成立 ¦ A request precondition (If-Match etc.) evaluated false ¦ 前提条件（If-Match など）が満たされない ¦ 사전 조건(If-Match 등)이 거짓', '樂觀鎖更新時 ETag 已過期 ¦ Optimistic-locking update with a stale ETag ¦ 楽観ロックで ETag が古い ¦ 낙관적 락 업데이트 시 ETag가 오래됨'],
  [413, 'Content Too Large', '請求本文超過伺服器允許大小 ¦ Request body is larger than the server allows ¦ リクエスト本文が大きすぎる ¦ 요청 본문이 허용 크기를 초과', '上傳檔案過大；Nginx 的 client_max_body_size ¦ Oversized upload; e.g. Nginx client_max_body_size ¦ 大きすぎるアップロード。Nginx の client_max_body_size など ¦ 업로드 용량 초과, Nginx client_max_body_size 등'],
  [414, 'URI Too Long', '網址過長 ¦ The URI is too long ¦ URI が長すぎる ¦ URI가 너무 김', 'GET 查詢字串塞太多資料，應改用 POST ¦ Too much data in a GET query string; use POST instead ¦ GET のクエリに詰め込みすぎ。POST を使う ¦ GET 쿼리에 데이터를 너무 많이 담음, POST 사용'],
  [415, 'Unsupported Media Type', '不支援請求本文的格式 ¦ The request body media type is unsupported ¦ 本文のメディアタイプが未対応 ¦ 지원하지 않는 본문 형식', 'Content-Type 錯誤，如該送 application/json ¦ Wrong Content-Type, e.g. should be application/json ¦ Content-Type の誤り（application/json にすべき等） ¦ Content-Type 오류, 예: application/json이어야 함'],
  [416, 'Range Not Satisfiable', '要求的位元組範圍無效 ¦ The requested byte range cannot be served ¦ 要求された範囲が不正 ¦ 요청한 바이트 범위가 유효하지 않음', 'Range 超出檔案大小，續傳位置錯誤 ¦ Range beyond file size; bad resume offset ¦ Range がファイルサイズ超過、再開位置の誤り ¦ Range가 파일 크기를 넘음, 이어받기 위치 오류'],
  [417, 'Expectation Failed', '無法滿足 Expect 標頭的要求 ¦ The Expect header cannot be met ¦ Expect ヘッダーの条件を満たせない ¦ Expect 헤더 요구를 충족할 수 없음', '伺服器或代理不支援 Expect: 100-continue ¦ A server or proxy does not support Expect: 100-continue ¦ サーバーやプロキシが Expect: 100-continue 未対応 ¦ 서버나 프록시가 Expect: 100-continue 미지원'],
  [418, "I'm a teapot", '我是茶壺（愚人節玩笑，RFC 2324） ¦ I am a teapot (April Fools RFC 2324) ¦ 私はティーポット（エイプリルフールの RFC 2324） ¦ 나는 찻주전자(만우절 RFC 2324)', '彩蛋或刻意拒絕機器人／爬蟲；不是正式用途 ¦ Easter egg, or a playful way to refuse bots; not for real semantics ¦ 遊び心のある拒否やボット除け。正式用途ではない ¦ 이스터에그 또는 봇 거부용, 정식 용도는 아님'],
  [421, 'Misdirected Request', '請求被送到無法回應的伺服器 ¦ The request was sent to a server that cannot answer it ¦ 応答できないサーバーに送られた ¦ 응답할 수 없는 서버로 요청이 전달됨', 'HTTP/2 連線重用時 SNI 與主機不符 ¦ HTTP/2 connection reuse where SNI and host do not match ¦ HTTP/2 接続再利用で SNI とホストが不一致 ¦ HTTP/2 연결 재사용 시 SNI와 호스트 불일치'],
  [422, 'Unprocessable Content', '格式正確但內容語意無法處理 ¦ Well-formed but semantically invalid content ¦ 形式は正しいが内容が処理できない ¦ 형식은 맞지만 의미상 처리할 수 없음', '表單驗證失敗（欄位值不合規則），REST API 常用 ¦ Validation failures on fields; common in REST APIs ¦ フィールド検証エラー。REST API でよく使う ¦ 필드 검증 실패, REST API에서 흔히 사용'],
  [423, 'Locked', '資源被鎖定（WebDAV） ¦ The resource is locked (WebDAV) ¦ リソースがロックされている（WebDAV） ¦ 리소스가 잠겨 있음(WebDAV)', '他人正在編輯、持有鎖定 ¦ Someone else holds the lock ¦ 他のユーザーがロックを保持 ¦ 다른 사용자가 잠금을 보유'],
  [424, 'Failed Dependency', '因前一個請求失敗而無法執行（WebDAV） ¦ Failed because a previous request failed (WebDAV) ¦ 前のリクエストの失敗により実行不可（WebDAV） ¦ 이전 요청 실패로 수행 불가(WebDAV)', '批次操作中某步驟失敗，連帶影響後續 ¦ A step in a batch failed and blocked the dependents ¦ 一括処理の途中で失敗し後続が連鎖失敗 ¦ 일괄 작업 중 한 단계가 실패해 후속 작업도 실패'],
  [425, 'Too Early', '伺服器不願處理可能被重放的請求 ¦ Server won\'t risk processing a request that might be replayed ¦ 再送されうるリクエストの処理を拒否 ¦ 재전송될 수 있는 요청 처리를 거부', 'TLS 1.3 early data（0-RTT）有重放風險 ¦ TLS 1.3 early data (0-RTT) carries replay risk ¦ TLS 1.3 early data（0-RTT）のリプレイ対策 ¦ TLS 1.3 early data(0-RTT) 재전송 위험'],
  [426, 'Upgrade Required', '須改用其他協定（如升級到 TLS） ¦ Client must switch to another protocol ¦ 別のプロトコルへのアップグレードが必要 ¦ 다른 프로토콜로 업그레이드해야 함', '伺服器要求以 Upgrade 標頭指定的新協定連線 ¦ The server insists on the protocol named in the Upgrade header ¦ Upgrade ヘッダーで示すプロトコルを要求 ¦ Upgrade 헤더에 지정한 프로토콜을 요구'],
  [428, 'Precondition Required', '要求必須附帶條件式標頭 ¦ The request must be conditional ¦ 条件付きリクエストが必須 ¦ 조건부 요청이어야 함', '避免「遺失更新」，強制帶 If-Match ¦ Prevents lost updates by requiring If-Match ¦ 更新の消失を防ぐため If-Match を必須にする ¦ 갱신 손실 방지를 위해 If-Match 필수'],
  [429, 'Too Many Requests', '請求太頻繁，已被限流 ¦ Too many requests; you were rate limited ¦ リクエストが多すぎる（レート制限） ¦ 요청이 너무 많음(속도 제한)', '超過 API 速率限制；看 Retry-After 稍後重試 ¦ API rate limit exceeded; honour Retry-After and retry later ¦ API のレート制限超過。Retry-After に従い再試行 ¦ API 속도 제한 초과, Retry-After 후 재시도'],
  [431, 'Request Header Fields Too Large', '請求標頭太大 ¦ Request headers are too large ¦ リクエストヘッダーが大きすぎる ¦ 요청 헤더가 너무 큼', 'Cookie 累積過多或單一標頭過長 ¦ Too many cookies or one oversized header ¦ Cookie の蓄積や巨大なヘッダー ¦ 쿠키 과다 또는 헤더 하나가 너무 김'],
  [451, 'Unavailable For Legal Reasons', '因法律原因無法提供 ¦ Unavailable for legal reasons ¦ 法的理由により提供不可 ¦ 법적 사유로 제공 불가', '法院命令、版權下架或地區法規封鎖（名稱取自《華氏 451 度》） ¦ Court order, takedown or regional law (named after Fahrenheit 451) ¦ 裁判所命令、著作権削除、地域法規（『華氏 451 度』由来） ¦ 법원 명령, 저작권 삭제, 지역 법규(화씨 451도에서 유래)'],
  [500, 'Internal Server Error', '伺服器內部發生未預期的錯誤 ¦ Unexpected error on the server ¦ サーバー内部で予期せぬエラー ¦ 서버 내부 오류', '程式例外、設定錯誤；應查看伺服器日誌 ¦ Unhandled exception or misconfiguration; check server logs ¦ 未処理の例外や設定ミス。サーバーログを確認 ¦ 처리되지 않은 예외나 설정 오류, 서버 로그 확인'],
  [501, 'Not Implemented', '伺服器尚未實作此功能 ¦ The server does not support this functionality ¦ サーバーがその機能を実装していない ¦ 서버가 해당 기능을 구현하지 않음', '不認得的請求方法（與 405 不同，是整台伺服器不支援） ¦ Unknown request method (unlike 405, the server never supports it) ¦ 未知のメソッド（405 と違いサーバー全体で未対応） ¦ 알 수 없는 메서드(405와 달리 서버 전체가 미지원)'],
  [502, 'Bad Gateway', '閘道／代理從上游收到無效回應 ¦ Gateway got an invalid response from upstream ¦ ゲートウェイが上流から不正な応答を受信 ¦ 게이트웨이가 상위 서버에서 잘못된 응답을 받음', '後端服務當機或崩潰，Nginx／負載平衡器常見 ¦ Backend crashed or is down; common behind Nginx/load balancers ¦ バックエンドのダウンやクラッシュ。Nginx やロードバランサーで多い ¦ 백엔드 다운·크래시, Nginx/로드밸런서에서 흔함'],
  [503, 'Service Unavailable', '服務暫時無法使用 ¦ Service temporarily unavailable ¦ サービスが一時的に利用不可 ¦ 서비스를 일시적으로 사용할 수 없음', '維護中或過載；可附 Retry-After ¦ Maintenance or overload; may include Retry-After ¦ メンテナンスや過負荷。Retry-After を付けられる ¦ 점검 또는 과부하, Retry-After 포함 가능'],
  [504, 'Gateway Timeout', '閘道等不到上游回應而逾時 ¦ Gateway timed out waiting for upstream ¦ 上流の応答待ちでゲートウェイがタイムアウト ¦ 게이트웨이가 상위 서버 응답을 기다리다 타임아웃', '後端處理太慢，需調整逾時或優化查詢 ¦ Slow backend; raise timeouts or optimise the work ¦ バックエンドが遅い。タイムアウト調整や処理の最適化 ¦ 백엔드가 느림, 타임아웃 조정이나 최적화 필요'],
  [505, 'HTTP Version Not Supported', '不支援請求所用的 HTTP 版本 ¦ HTTP version not supported ¦ その HTTP バージョンは未対応 ¦ 해당 HTTP 버전을 지원하지 않음', '客戶端使用伺服器不接受的 HTTP 版本 ¦ Client used an HTTP version the server refuses ¦ サーバーが拒否する HTTP バージョンを使用 ¦ 서버가 거부하는 HTTP 버전 사용'],
  [506, 'Variant Also Negotiates', '內容協商設定出現循環參照 ¦ Content negotiation configuration loops ¦ コンテンツネゴシエーションの設定が循環 ¦ 콘텐츠 협상 설정이 순환 참조', '伺服器設定錯誤，極少見 ¦ Server misconfiguration; very rare ¦ サーバー設定ミス。非常に稀 ¦ 서버 설정 오류, 매우 드묾'],
  [507, 'Insufficient Storage', '儲存空間不足（WebDAV） ¦ Not enough storage to complete the request (WebDAV) ¦ ストレージ容量不足（WebDAV） ¦ 저장 공간 부족(WebDAV)', '磁碟或配額已滿，無法儲存上傳內容 ¦ Disk or quota is full ¦ ディスクやクォータが満杯 ¦ 디스크나 할당량이 가득 참'],
  [508, 'Loop Detected', '偵測到無限迴圈（WebDAV） ¦ An infinite loop was detected (WebDAV) ¦ 無限ループを検出（WebDAV） ¦ 무한 루프 감지(WebDAV)', 'WebDAV 綁定形成循環而中止處理 ¦ WebDAV bindings formed a cycle ¦ WebDAV のバインドが循環した ¦ WebDAV 바인딩이 순환함'],
  [510, 'Not Extended', '需要請求的擴充功能才能處理 ¦ Further extensions to the request are required ¦ リクエストの拡張が必要 ¦ 요청에 추가 확장이 필요', 'HTTP Extension Framework，幾乎不再使用 ¦ HTTP Extension Framework; practically unused ¦ HTTP Extension Framework。ほぼ未使用 ¦ HTTP Extension Framework, 사실상 사용 안 함'],
  [511, 'Network Authentication Required', '須先通過網路登入驗證 ¦ Network authentication is required ¦ ネットワーク認証が必要 ¦ 네트워크 인증 필요', '公共 Wi-Fi 的 captive portal 攔截連線 ¦ A captive portal on public Wi-Fi intercepts traffic ¦ 公衆 Wi-Fi のキャプティブポータルが通信を遮断 ¦ 공용 Wi-Fi의 캡티브 포털이 연결을 가로챔'],
]

export function classOf(code: number): StatusClass {
  return Math.floor(code / 100) as StatusClass
}

function split4(s: string): Record<Lang, string> {
  const p = s.split(' ¦ ')
  return { 'zh-TW': p[0], en: p[1], ja: p[2], ko: p[3] }
}

export const STATUS_CODES: readonly HttpStatus[] = RAW.map(([code, name, meaning, when]) => ({
  code,
  name,
  cls: classOf(code),
  meaning: split4(meaning),
  when: split4(when),
}))

export const STATUS_CLASSES: readonly StatusClass[] = [1, 2, 3, 4, 5]

/**
 * Filter by class and free text. Every whitespace-separated token must match
 * (AND): a code prefix ("40", "404"), the name, or the meaning/cause text in any language.
 */
export function searchStatus(list: readonly HttpStatus[], query: string, cls: StatusClass | null = null): HttpStatus[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter((s) => {
    if (cls !== null && s.cls !== cls) return false
    if (!tokens.length) return true
    const hay = [s.name, ...LANGS.map((l) => s.meaning[l]), ...LANGS.map((l) => s.when[l])].join('\n').toLowerCase()
    // Digit-only tokens are code prefixes (so "404" does not match texts that mention 404).
    return tokens.every((tk) => (/^\d+$/.test(tk) ? String(s.code).startsWith(tk) : hay.includes(tk)))
  })
}
