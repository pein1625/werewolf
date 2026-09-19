# Ma Sói Online

Thay bộ bài ma sói vật lý. Quản trò tạo phòng, phát mã hoặc QR, chia bài — mỗi người chỉ thấy lá của
mình trên điện thoại. Quản trò giữ toàn quyền điều khiển: đồng hồ chỉ nhắc giờ, chuyển bước là do
bạn bấm, và bấm nhầm thì hoàn tác được.

## Chạy

```bash
npm install
npm run dev          # http://localhost:3000
```

Terminal in luôn địa chỉ LAN — người chơi cùng wifi mở địa chỉ đó trên điện thoại là vào được, không
cần deploy gì cả.

Bản production:

```bash
npm run build
npm start
```

Biến môi trường: `PORT` (mặc định 3000), `WEREWOLF_DB` (mặc định `./data/werewolf.db`).

Chạy test:

```bash
npm test
```

Nó tự dựng server thật, cho ba bộ e2e đâm vào (một ván 6 người, bộ đủ 10 loại lá qua 5 đêm, và khôi
phục sau khi server chết giữa ván), rồi tự dọn.

## Luồng một ván

1. Quản trò bấm **Tạo phòng mới** → nhận mã 6 ký tự + QR.
2. Người chơi quét QR hoặc gõ mã, đặt tên, vào bàn.
3. Quản trò dựng bộ bài: kéo lá từ **kho** thả xuống **bàn** (hoặc chạm để thêm nhanh), hoặc chọn
   một **pack gợi ý** theo sĩ số. Rồi **Chia bài**.
4. Mỗi người xem lá của mình. Quản trò bấm **Bắt đầu đêm đầu tiên**.
5. Từ đây màn hình quản trò chỉ hiện **một bước tại một thời điểm**, kèm đúng câu cần đọc to và
   đúng các lựa chọn hợp lệ. Xem "Kịch bản dẫn" bên dưới.
6. App tự phát hiện điều kiện thắng và gợi ý kết thúc ván; kết ván thì lật bài toàn bàn.

## Kịch bản dẫn — màn hình quản trò

Quản trò không phải nhớ luật hay thứ tự gọi. Mỗi bước là một thẻ: câu thoại to, gợi ý nhỏ, và các
nút bấm đúng với bước đó.

> **Bước 2/7** — "Sói thức dậy. Đêm nay bầy sói muốn giết ai?"
> → lưới tên cả bàn — sói được phép cắn cả đồng bọn lẫn chính mình

> **Bước 5/7** — "Phù thủy thức dậy. Đêm nay An bị giết. Phù thủy có muốn cứu không?"
> → `Có — cứu An` | `Không cứu`

> **Bước 4/7** — "Trả lời Tiên tri bằng ngón tay cái."
> → hiện đáp án cho riêng quản trò: **KHÔNG PHẢI SÓI**

Kịch bản tự thích ứng theo ván:

- Lá không có trong bộ thì không xuất hiện; Cupid chỉ hiện ở đêm 1.
- Người giữ lá đã chết vẫn được gọi ("vẫn phải gọi, không thì cả bàn đoán ra") nhưng không chọn ai.
- Bảo vệ không được chọn lại người đêm trước — người đó bị loại khỏi lưới.
- Phù thủy hết bình thì bước đó biến mất; hết cả hai bình thì thành một bước gọi suông.
- Thợ săn chết là bước bắn **chen ngay lên đầu**, chặn mọi bước khác cho tới khi xử lý xong.

Đồng hồ chạy nền cho quản trò tham khảo, hết giờ có chuông + nhấp nháy, nhưng **không bao giờ tự
chuyển bước** — luôn là bạn bấm.

## Bộ bài

Dân làng · Sói · Sói trùm · Sói tiên tri · Tiên tri · Bảo vệ · Phù thủy · Thợ săn · Già làng · Cupid.

Pack gợi ý: Nhập môn (5-7), Cổ điển (8-10), Cân bằng (10-12), Đầy đủ (12-15), Hỗn loạn (14-20).
Chọn tay cũng được — app cảnh báo nếu số lá lệch sĩ số hoặc tỉ lệ sói hỏng.

## Hoàn tác

Mọi thao tác của quản trò là một event ghi vào log. Hoàn tác = bỏ event cuối rồi dựng lại trạng thái
từ đầu — nên nó trả lại đúng mọi thứ: người chết sống lại, bình thuốc phù thủy chưa dùng, thợ săn
hết chờ bắn. Không có thao tác nào "không lùi được".

Log đó cũng chính là lịch sử ván: ai chết, ở đêm/ngày nào, vì sao, do ai.

## Ai thấy gì

Server không bao giờ gửi lá bài của người khác xuống máy người chơi.

Màn hình người chơi cố tình chỉ có hai thứ: **lá bài của mình** và **còn sống hay đã chết**. Không
danh sách cả bàn, không đồng hồ, không sổ soi — mọi thông tin khác đến từ miệng quản trò, đúng như
chơi bài giấy. Điện thoại chỉ đóng vai lá bài úp.

Lá bài vẽ như bài thật: khung đôi, hình ở giữa, tên vai, phe, và mô tả ngắn; ký hiệu nhỏ ở hai góc
đối nhau. Tên người chơi nằm ở góc trên bên trái, chữ nhỏ. Chết thì lá bài xám lại và đóng dấu
**ĐÃ CHẾT** ở phần dưới — vẫn đọc được mình là lá gì.

| | Quản trò | Người chơi |
|---|---|---|
| Lá của chính mình | thấy hết | thấy |
| Lá của người khác | thấy hết | không, tới khi kết ván |
| Đồng bọn sói | thấy | chỉ sói thấy nhau |
| Người yêu (Cupid) | thấy | chỉ hai người trong đôi |
| Kết quả soi của tiên tri | thấy | không hiện — quản trò trả lời miệng |
| Đồng hồ | có | không |
| Nguyên nhân chết | thấy ngay | chỉ lá của mình; cả bàn lộ khi kết ván |

## Deploy lên VPS (Ubuntu + Docker)

```bash
git clone https://github.com/pein1625/werewolf.git
cd werewolf
docker compose up -d --build
```

Xong. Mở `http://<IP-VPS>:3000`.

Nếu VPS bật tường lửa thì mở cổng trước: `sudo ufw allow 3000/tcp`.

Vài lệnh hay dùng:

```bash
docker compose logs -f        # xem log
docker compose restart        # khởi động lại, KHÔNG mất ván đang chơi
docker compose down           # tắt, volume vẫn giữ nguyên dữ liệu
git pull && docker compose up -d --build   # cập nhật phiên bản mới
```

Ván đang chơi nằm trong volume `werewolf-data` gắn vào `/data`, nên restart hay deploy lại đều
không mất. Đã kiểm chứng: restart container giữa đêm thì phòng quay lại đúng bước đang dở.

Muốn đổi cổng thì sửa `ports` trong `docker-compose.yml`, ví dụ `"80:3000"` để vào thẳng
`http://<IP-VPS>` không cần gõ cổng.

Chạy `http://` trần vẫn chơi tốt. Nếu sau này gắn tên miền và muốn HTTPS thì đặt một reverse proxy
(Caddy, Traefik) trước container — khi đó nút Copy link dùng được clipboard API thật thay vì đường
dự phòng.

## Tự động deploy khi push lên main

`.github/workflows/deploy.yml` chạy mỗi lần push vào `main` (merge PR cũng tính là push):

1. **Kiểm tra** — `npm ci` → `typecheck` → `build` → `npm test` (cả ba bộ e2e).
2. **Deploy** — chỉ chạy khi bước trên xanh. SSH vào VPS, `git pull`, `docker compose up -d --build`.
3. **Kiểm tra sống** — gọi thử app sau khi deploy, hỏng thì job đỏ.

Pull request cũng chạy bước kiểm tra nhưng **không** deploy. Code hỏng thì không bao giờ chạm tới VPS.

### Khai báo secret

Vào repo trên GitHub → Settings → Secrets and variables → Actions:

| Secret | Nội dung |
|---|---|
| `VPS_HOST` | IP hoặc tên miền VPS |
| `VPS_USER` | user SSH, ví dụ `root` hay `ubuntu` |
| `VPS_SSH_KEY` | **private key** của cặp khoá deploy (dán nguyên, cả dòng BEGIN/END) |
| `VPS_KNOWN_HOSTS` | host key của VPS, chống bị giả mạo máy đích |
| `VPS_PORT` | cổng SSH nếu khác 22 (không bắt buộc) |
| `VPS_APP_DIR` | thư mục chứa repo trên VPS, mặc định `~/werewolf` (không bắt buộc) |
| `VPS_HEALTH_URL` | ví dụ `http://IP:3000` để kiểm tra sau deploy (không bắt buộc) |

### Tạo khoá deploy

Trên máy bạn:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/werewolf_deploy -N "" -C "github-actions"
ssh-copy-id -i ~/.ssh/werewolf_deploy.pub <user>@<IP-VPS>
cat ~/.ssh/werewolf_deploy          # dán vào secret VPS_SSH_KEY
ssh-keyscan -H <IP-VPS>             # dán vào secret VPS_KNOWN_HOSTS
```

Dùng khoá riêng cho việc deploy, đừng dùng khoá cá nhân — lộ là mất cả máy.

### Điều kiện trên VPS

Repo phải đã được clone sẵn đúng chỗ (workflow chỉ `git pull`, không clone hộ):

```bash
git clone https://github.com/pein1625/werewolf.git ~/werewolf
```

Repo private thì VPS cần quyền đọc — thêm một deploy key read-only trong Settings → Deploy keys.

Workflow dùng `git pull --ff-only`, nên nếu ai đó sửa file trực tiếp trên VPS làm lệch nhánh thì
deploy sẽ **đỏ và dừng**, không âm thầm ghi đè. Muốn VPS luôn khớp `main` bất chấp thì đổi thành
`git reset --hard origin/main` — nhưng nó xoá mọi thay đổi tại chỗ.

### Deploy giữa lúc đang chơi

Container restart nên mọi người rớt kết nối vài giây. Không mất ván: state nằm trong volume, client
tự nối lại bằng token trong trình duyệt và về đúng bước đang dở. Dù vậy, đừng deploy giữa ván.

## Tự động deploy không cần GitHub Actions

Dùng khi tài khoản GitHub không chạy được Actions, hoặc khi không muốn cất khoá SSH trên GitHub.
VPS tự kéo code về, không có kết nối nào đi vào máy, không cần thẻ, không cần secret.

`deploy/auto-deploy.sh` làm đúng một vòng:

1. `git fetch` — không có commit mới thì thoát ngay, không tốn gì.
2. Có commit mới → `docker compose build` (container cũ **vẫn đang chạy**).
3. Chạy `npm test` trong image vừa build.
4. Test xanh → `docker compose up -d` đổi sang bản mới.
   Test đỏ → **giữ nguyên bản đang chạy**, ghi sha hỏng vào `.deploy-failed-sha` để không build lại mỗi phút.

Cài trên VPS:

```bash
cd ~/apps/werewolf && git pull
crontab -e
```

Thêm hai dòng (sửa đường dẫn nếu repo nằm chỗ khác):

```cron
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/2 * * * * /usr/bin/flock -n /tmp/werewolf-deploy.lock /home/deploy/apps/werewolf/deploy/auto-deploy.sh >> /home/deploy/apps/werewolf/deploy.log 2>&1
```

Dòng `PATH` là bắt buộc — cron chạy với PATH rất hẹp, thiếu nó thì không tìm thấy `docker`.
`flock -n` bỏ qua lượt chạy nếu lượt trước còn đang build, tránh hai bản build chồng nhau.

Theo dõi:

```bash
tail -f ~/apps/werewolf/deploy.log
```

Chạy tay một lượt không cần chờ cron:

```bash
~/apps/werewolf/deploy/auto-deploy.sh
```

Sau khi một commit hỏng làm deploy dừng, sửa xong và push commit mới là nó tự chạy lại; hoặc xoá
`.deploy-failed-sha` để ép thử lại ngay commit cũ.

Cách này và workflow GitHub Actions chạy song song được. Actions deploy trước thì vòng cron sau đó
thấy không có gì mới và thoát, không deploy đúp.

## Restart không mất ván

Event log nằm trong SQLite (`node:sqlite`, không cần cài gì thêm). Server chết giữa ván, bật lại là
phòng vẫn nguyên — quản trò và người chơi vào lại bằng token lưu trong trình duyệt.

## Kiến trúc

```
server.ts              Next.js + Socket.IO trong cùng một process
src/game/              domain thuần, không phụ thuộc server
  roles.ts             10 lá + thứ tự gọi đêm
  events.ts            kiểu event + kiểu trạng thái
  reducer.ts           fold(event) -> trạng thái; nơi duy nhất luật game sống
  packs.ts             pack gợi ý + validate cân bằng
  script.ts            sinh kịch bản từng bước cho quản trò từ trạng thái hiện tại
  views.ts             cắt trạng thái thành view cho host / cho từng người chơi
src/server/
  db.ts                SQLite: room, event log, member
  rooms.ts             runtime phòng, undo, đồng hồ
  socket.ts            lệnh của quản trò + kiểm tra hợp lệ
src/components/
  RoleArt.tsx          hình cho 10 lá bài, SVG inline — không phụ thuộc file ảnh ngoài
src/app/               giao diện (Next App Router)
  host/[code]/StepPanel.tsx    thẻ "bước hiện tại"
  host/[code]/DeckBuilder.tsx  kho bài + bàn, kéo thả bằng pointer (chạy cả chuột lẫn cảm ứng)
```

Luật game chỉ nằm trong `reducer.ts`; lời dẫn và thứ tự gọi nằm trong `script.ts`. Thêm lá mới =
thêm vào `roles.ts`, thêm hình trong `RoleArt.tsx`, thêm nhánh trong `reducer.ts`, thêm bước trong
`script.ts`. Giao diện không phải sửa — `StepPanel` render theo mô tả bước.

## CSS — một cái bẫy đã dính

Dự án dùng Tailwind v4. Cú pháp `bg-[--color-gold]` (kiểu v3) **không sinh ra CSS nào** ở v4: không
lỗi, không cảnh báo, build vẫn xanh, chỉ là phần tử mất màu. Các token màu khai báo trong `@theme`
đã tự sinh utility thật rồi — dùng `bg-gold`, `text-mist`, `border-edge`, kèm cả `bg-gold/25`.

Nếu nghi một class không ăn, đừng đọc source — kiểm tra trên CSS đã build:

```bash
npm run build && grep -o '\.bg-gold[,{ ]' $(find .next -name '*.css' -size +1k | head -1)
```
