# Tổng quan phần mềm AsiaTravelPlan

### So sánh với quy trình thủ công bằng Word, Canva, hóa đơn và biên nhận

Trước khi có hệ thống này, một công ty du lịch có thể tạo kế hoạch du lịch thủ công bằng Microsoft Word, Canva, Google Docs hoặc các công cụ tương tự, sau đó tạo hóa đơn và biên nhận thanh toán bằng các mẫu kế toán riêng. Cách này có thể phù hợp khi số lượng chuyến đi còn ít, nhưng sẽ tạo ra nhiều vấn đề vận hành khi khối lượng công việc tăng lên.

Việc tạo tài liệu thủ công thường có nghĩa là:

- mỗi kế hoạch du lịch được sao chép từ một file cũ hoặc được dựng lại từ đầu
- chất lượng định dạng phụ thuộc vào từng nhân viên
- giá, ngày, tên, điểm đến và điều khoản thanh toán phải được nhập lại ở nhiều nơi
- nội dung lịch trình, PDF báo giá, hóa đơn, biên nhận và ghi chú nội bộ của booking có thể bị lệch nhau
- muốn tái sử dụng một lịch trình tốt thì phải tìm trong các file cũ và sao chép thủ công từng phần
- nội dung đa ngôn ngữ cần thêm công việc dịch và dàn trang thủ công
- lịch sử hóa đơn và biên nhận không tự nhiên gắn với booking, báo giá hoặc bước thanh toán
- quản lý khó nhìn rõ phiên bản nào đã được gửi, đã thanh toán hoặc đã được chấp nhận

Hệ thống backend thay thế quy trình đó bằng dữ liệu booking có cấu trúc và các tài liệu được sinh tự động.

Với kế hoạch du lịch, lợi ích thực tế là khả năng tái sử dụng:

- standard tours được quản lý trực tiếp như nội dung kế hoạch du lịch tái sử dụng và có thể áp dụng vào bookings
- từng ngày riêng lẻ từ các kế hoạch du lịch hiện có có thể được tìm kiếm và tái sử dụng
- từng dịch vụ riêng lẻ từ các kế hoạch du lịch hiện có có thể được tìm kiếm và tái sử dụng
- nội dung kế hoạch du lịch khi được sao chép sẽ nhận ID mới riêng cho booking mới, nên có thể chỉnh sửa an toàn cho khách hàng mới
- các tuyến đường, cấu trúc ngày, mô tả, ghi chú khách sạn/dịch vụ và hình ảnh chất lượng cao có thể trở thành các khối nội dung tái sử dụng
- nhân viên có thể bắt đầu từ nội dung đã được kiểm chứng rồi tùy chỉnh, thay vì bắt đầu từ một trang Word hoặc Canva trống
- PDF kế hoạch du lịch được sinh từ nội dung booking có cấu trúc, giúp đầu ra nhất quán

Với tài chính, lợi ích thực tế là tính nhất quán và khả năng truy vết:

- báo giá, PDF báo giá đã sinh, yêu cầu thanh toán, bản ghi tiền đã nhận và PDF biên nhận đều gắn với booking
- tài liệu thanh toán được sinh từ luồng thanh toán thay vì được nhập thủ công trong một file hóa đơn riêng
- tài liệu biên nhận gắn với đúng dòng thanh toán mà nó xác nhận
- snapshot thương mại đã được chấp nhận ngăn việc các chỉnh sửa sau này âm thầm thay đổi bối cảnh thanh toán trong quá khứ
- nhân viên và quản lý có thể kiểm tra lịch sử booking thay vì phải dựng lại từ email và tên file

Điều này không thay thế chuyên môn của nhân viên. Nhân viên vẫn thiết kế chuyến đi, điều chỉnh tuyến đường, viết chi tiết riêng cho khách hàng và quyết định nội dung nào nên gửi. Hệ thống loại bỏ việc lắp ráp tài liệu lặp đi lặp lại, giảm lỗi sao chép/dán và biến những công việc tốt nhất trước đây thành tri thức vận hành có thể tái sử dụng.


Tài liệu này cung cấp tổng quan cho nhân viên mới cần hiểu hệ thống AsiaTravelPlan. Nó không thay thế các tài liệu kỹ thuật chi tiết. Tài liệu này giải thích kiến trúc chính, các quy trình vận hành và nơi cần đọc tiếp.

Bắt đầu với file này, sau đó đọc:

- [README.md](../README.md)
- [documentation/current_system_map.md](current_system_map.md)
- [documentation/concept/software_architecture.md](concept/software_architecture.md)
- [documentation/concept/i18n_runtime.md](concept/i18n_runtime.md)
- [documentation/backend/README.md](backend/README.md)
- [documentation/backend/hetzner.md](backend/hetzner.md)
- [documentation/concept/backup.md](concept/backup.md)

## 1. Tổng quan hệ thống trong một trang

AsiaTravelPlan là một website công khai dạng static kết hợp với một backend workspace có xác thực cho hoạt động vận hành của công ty du lịch.

Hệ thống bao gồm:

- website marketing công khai với các thẻ tour và form booking
- backend workspace cho bookings, offers, travel plans, payments, tours, staff profiles và settings
- model CUE định nghĩa domain entities, API payloads, enums và generated contracts
- backend Node với cơ chế lưu trữ ứng dụng dạng file
- xác thực và phân quyền bằng Keycloak
- Caddy reverse proxy và static file serving
- triển khai local, staging và production dựa trên Docker Compose
- hạ tầng Hetzner và đường dẫn backup bằng Hetzner Storage Box

Mô hình tư duy quan trọng nhất:

1. `model/` định nghĩa ý nghĩa dùng chung của hệ thống.
2. Generator tạo OpenAPI và các file contract JS.
3. Backend và frontend sử dụng các file generated đó.
4. Runtime data chủ yếu là JSON/files, không phải Git.
5. Dữ liệu tour/team cho public homepage được sinh từ nội dung có thể chỉnh sửa.

## 2. Hạ tầng: Hetzner Server và Storage Box

### Server

Mục tiêu server được tài liệu hóa là Hetzner Cloud `CX32` chạy Ubuntu 24.04.

Server stack sử dụng:

- Docker và Docker Compose
- Caddy cho HTTPS, static file serving và reverse proxy
- container Node backend
- container Keycloak
- container PostgreSQL cho dữ liệu Keycloak
- file volumes/directories cho runtime data và content của ứng dụng

Bố cục server hiện tại được các deploy scripts sử dụng:

- production checkout: `/srv/asiatravelplan`
- staging checkout: `/srv/asiatravelplan-staging`
- public Caddy runtime root: `/srv/asiatravelplan-public`
- production compose project: `asiatravelplan`
- staging compose project: `asiatravelplan-staging`
- shared Caddy compose project: `asiatravelplan-public`

Các host quan trọng:

- production website: `https://asiatravelplan.com`
- staging website: `https://staging.asiatravelplan.com`
- staging API: `https://api-staging.asiatravelplan.com`
- staging Keycloak: `https://auth-staging.asiatravelplan.com`

Production Caddy phục vụ website công khai và các backend pages từ production checkout, proxy `/api/*`, `/auth/*`, `/public/v1/*` và `/integrations/*` đến production backend, đồng thời proxy `/keycloak/*` đến production Keycloak.

Staging Caddy bảo vệ hầu hết staging pages bằng staging access, phục vụ static files từ staging checkout và proxy các route backend/API/auth đến staging backend và Keycloak.

### Storage Box

Chiến lược backup sử dụng off-server storage. Hetzner Storage Box là mục tiêu cụ thể hiện tại cho các staging backup scripts.

Scripts đã được triển khai:

- `scripts/content/backup_staging_to_storage_box.sh`
- `scripts/content/restore_staging_from_storage_box.sh`

Staging backup script tạo:

- `content.tar.gz`
- `backend-app-data.tar.gz`
- `manifest.json`
- `sha256sums.txt`

Nó upload các file này lên Storage Box qua SFTP trên port `23`.

Các environment variables bắt buộc:

- `STORAGE_BOX_USER`
- `STORAGE_BOX_HOST`

Các environment variables tùy chọn:

- `STAGING_ROOT`, mặc định `/srv/asiatravelplan-staging`
- `STORAGE_BOX_KEY`, mặc định `~/.ssh/storage_box_backup`
- `BACKUP_PREFIX`, mặc định `staging/snapshots`
- `LOCAL_TMP_ROOT`, mặc định `/tmp`
- `KEEP_LOCAL_ARCHIVES`

Yêu cầu backup production được tài liệu hóa trong [documentation/concept/backup.md](concept/backup.md). Concrete production backup script hiện chưa có trong repository, vì vậy nhân viên mới không nên giả định production backups hoạt động giống staging cho đến khi được xác minh với project owner.

Nguyên tắc backup:

- production là source of truth
- backups được tạo trên server, không phải trên laptop
- backups phải được lưu off-server
- staging không phải là backup của production
- Git là audit/history, không phải hệ thống backup chính
- một backup chỉ đáng tin khi đã được restore thử nghiệm

## 3. Cách sử dụng Git repository

### Bản đồ repository

Các khu vực top-level quan trọng:

- `model/` - CUE source of truth cho entities, API shapes, enums và normalized IR
- `tools/generator/` - generation scripts
- `api/generated/` - generated OpenAPI và metadata
- `shared/generated-contract/` - generated JS contract được runtime code sử dụng
- `backend/app/Generated/` - backend generated contract re-exports
- `frontend/Generated/` - frontend generated contract re-exports
- `backend/app/` - backend runtime code và runtime data directory
- `frontend/pages/` - static HTML pages
- `frontend/scripts/` - browser ES modules
- `shared/css/` - CSS dùng chung và styles theo page/component
- `shared/js/` - browser helpers dùng chung
- `content/` - source nội dung có thể chỉnh sửa cho tours, standard tours, staff và country reference
- `backup/` - chỉ là bản backup copy, không phải runtime source đang active
- `assets/` - website assets và generated homepage media
- `scripts/` - scripts cho local, staging, production, content, asset, i18n và utilities
- `documentation/` - tài liệu architecture, backend, frontend, infrastructure và concept
- `mobile/iOS/` - SwiftUI iOS shell đã rút gọn

### Nội dung nên thuộc Git

Commit:

- source code
- thay đổi CUE model
- generated contract files sau khi thay đổi model
- static frontend files
- editable content cần được versioned
- documentation
- deployment scripts và examples

Không commit:

- file `.env` chứa secrets thật
- `backend/app/data/store.json`
- runtime PDFs được sinh
- booking images được upload
- traveler photos/documents
- Keycloak runtime database data
- local temporary files

### Quy tắc generated code

Không hand-edit generated files trong workflow thông thường.

Khi model thay đổi, cập nhật CUE files trước, sau đó regenerate:

```bash
ruby tools/generator/generate_mobile_contract_artifacts.rb
```

Generated outputs bao gồm:

- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/`
- `backend/app/Generated/`
- `frontend/Generated/`
- `mobile/iOS/Generated/` chỉ khi được generate rõ ràng cho iOS

### Deployment và Git

Server update scripts kỳ vọng deployment flow bằng Git sạch.

Staging update:

```bash
cd /srv/asiatravelplan-staging
./scripts/deploy/update_staging.sh all
```

Production update:

```bash
cd /srv/asiatravelplan
./scripts/deploy/update_production.sh all
```

Staging update script chạy `git fetch origin` và `git pull --ff-only`. Điều này nghĩa là thay đổi phải được merge vào branch mà server sử dụng trước khi deploy.

Repository-root wrappers cũng tồn tại:

```bash
./deploy_frontend
./deploy_backend
./deploy_keycloak
./deploy_all
```

Chúng dispatch khác nhau tùy theo việc được chạy từ local checkout, staging checkout hay production checkout.

## 4. Phát triển local

Các lệnh local phổ biến:

```bash
./scripts/local/deploy_local_all.sh
./scripts/local/deploy_local_backend.sh
./scripts/local/deploy_local_frontend.sh
./scripts/local/deploy_local_backend_frontend.sh
```

Chỉ chạy backend:

```bash
cd backend/app
npm start
```

Backend default URL:

```text
http://localhost:8787
```

Local Caddy có thể phục vụ frontend bằng local Caddy compose file. Local Keycloak sử dụng:

- `docker-compose.local-keycloak.yml`
- port `8081`

Các lệnh maintenance hữu ích:

```bash
./scripts/content/wipe_local_bookings.sh --yes
node scripts/assets/generate_public_homepage_assets.mjs
./scripts/i18n/translate check
```

Chạy backend tests từ `backend/app`:

```bash
npm test
```

Deploy scripts cũng chạy một số backend tests trước khi deploy backend lên staging/production.

## 5. Authentication, roles và access

Authentication dựa trên Keycloak khi `KEYCLOAK_ENABLED=true`.

Backend hỗ trợ:

- session cookie login qua `/auth/login` và `/auth/callback`
- bearer-token API authorization
- insecure test-auth mode chỉ khi được bật cho tests

Role names hiện gồm:

- `atp_admin`
- `atp_manager`
- `atp_accountant`
- `atp_staff`
- `atp_tour_editor`

Các access rules quan trọng trong runtime hiện tại:

- settings chỉ dành cho admin
- booking list access dành cho admin, manager, accountant và staff roles
- admin, manager và accountant có thể đọc tất cả bookings
- admin và manager có thể edit tất cả bookings và thay đổi assignment
- staff chỉ có thể đọc và edit bookings được assigned cho Keycloak user id của họ
- accountant chủ yếu là read-only cho các booking operations
- tour read access hiện dành cho admin, accountant và tour editor
- tour edit access hiện dành cho admin và tour editor
- standard tours có sẵn cho admin, manager và staff
- Keycloak user directory visibility có sẵn cho admin, manager và accountant

Access rules nằm ở:

- `backend/app/src/domain/access.js`
- `frontend/scripts/shared/nav.js`
- page-specific permission logic như `frontend/scripts/pages/settings_list.js`

Nếu docs và UI không khớp, hãy kiểm tra các file đó vì chúng mô tả runtime behavior hiện tại.

## 6. Kiến trúc public website

Public website là static HTML cộng với browser ES modules.

Main entry points:

- `frontend/pages/index.html`
- `frontend/scripts/main.js`
- `frontend/scripts/main_tours.js`
- `shared/css/styles.css`

Caddy rewrite `/` và page URLs đến các file trong `frontend/pages/`, đồng thời phục vụ assets trực tiếp.

Homepage bao gồm:

- hero video và destination/style controls
- dynamic tours grid
- trust và review sections
- FAQ
- contact/booking call to action
- multi-step booking modal

Booking form submit đến:

```text
POST /public/v1/bookings
```

Backend lưu public form submission gốc vào:

```text
booking.web_form_submission
```

Nó cũng tạo booking-owned person data đã normalize trong:

```text
booking.persons[]
```

### Static Homepage Data

Public tour/team data không được production homepage đọc live từ backend. Dữ liệu này được sinh thành static frontend files.

Source of truth:

- `content/tours/<tour_id>/tour.json`
- `content/atp_staff/staff.json`
- `content/atp_staff/photos/*`
- `content/country_reference_info.json`

Generated outputs:

- `frontend/data/generated/homepage/public-tours.<lang>.json`
- `frontend/data/generated/homepage/public-team.json`
- `assets/generated/homepage/tours/<tour_id>/<file>`
- `assets/generated/homepage/team/<file>`

Regenerate sau khi thay đổi public homepage content:

```bash
node scripts/assets/generate_public_homepage_assets.mjs
```

## 7. Tours và chỉnh sửa nội dung trong backend

Tours có thể được edit trong backend qua:

- `frontend/pages/marketing_tours.html`
- `frontend/pages/marketing_tour.html`
- `frontend/scripts/pages/tours_list.js`
- `frontend/scripts/pages/tour.js`

Backend handlers:

- `backend/app/src/http/handlers/tours.js`
- `backend/app/src/domain/tours_support.js`
- `backend/app/src/domain/tour_catalog_i18n.js`

Tour source files nằm trong:

```text
content/tours/<tour_id>/tour.json
```

Tour images được lưu cùng tour content và cũng được copy vào generated homepage assets.

Public destination visibility được kiểm soát qua:

```text
content/country_reference_info.json
```

Giá trị `published_on_webpage` kiểm soát việc một destination có xuất hiện trên public website và trong public tours output hay không. Settings page hiển thị phần này là "Website destinations".

Tour publishing rules:

- destination options trên homepage chỉ dựa trên các destinations hiện đang published
- nếu chỉ một destination được published, destination selector sẽ bị ẩn
- thứ tự tour cards dùng human priority cộng với một random component
- tours mới mặc định priority `50`
- priority hiện có được sync script giữ nguyên

## 8. Kiến trúc translation và language

Runtime có ba mối quan tâm language khác nhau:

1. public website language
2. backend UI language
3. customer-facing content language

Không gộp các khái niệm này khi thay đổi hệ thống.

Các file quan trọng:

- `shared/generated/language_catalog.js`
- `frontend/scripts/shared/frontend_i18n.js`
- `frontend/scripts/shared/backend_i18n.js`
- `frontend/scripts/booking/i18n.js`
- `frontend/scripts/booking/localized_editor.js`
- `backend/app/src/domain/booking_content_i18n.js`
- `backend/app/src/domain/booking_translation.js`
- `backend/app/src/domain/tour_catalog_i18n.js`
- `backend/app/src/lib/pdf_i18n.js`

Hành vi hiện tại:

- backend UI language là ngôn ngữ source/editing của ATP staff cho các workflow đã được refactor
- customer content language là target language cho nội dung hướng đến khách hàng
- localized fields được lưu dưới dạng maps theo language key
- flat strings trong API responses là projections đã resolve cho requested language
- translation endpoints dùng rõ ràng `source_lang` và `target_lang`
- translation status metadata có thể phát hiện translations đã cũ
- các chỉnh sửa thủ công ở target language có thể được giữ lại qua các lần auto-translation sau
- generated offers, travel-plan PDFs và payment PDFs dùng customer/document language, không dùng backend UI language

Ví dụ về localized persisted fields:

- tour title, short description và highlights
- offer labels và details
- travel plan titles, locations, notes và segment details
- payment document titles, notes và component descriptions
- ATP staff profile position và descriptions

## 9. Kiến trúc model, API, backend và frontend

### Model

CUE model là source of truth.

Các folder quan trọng:

- `model/json/` - file-backed content entities như tours, standard tours, ATP staff và country reference
- `model/database/` - operational entities như bookings, booking persons, offers, travel plans, payment documents
- `model/api/` - transport request/response shapes và read models
- `model/enums/` - currencies, languages, countries, roles, statuses, travel styles, payment kinds
- `model/common/` - reusable base, money và constraint definitions
- `model/ir/` - normalized intermediate representation được generator sử dụng

Quy tắc quan trọng:

- persisted business state thuộc `model/json/` hoặc `model/database/`
- response-only fields thuộc `model/api/`
- generated read models không nên vô tình trở thành persisted fields

### API Contract

API contract được generate từ CUE.

Các outputs quan trọng:

- `api/generated/openapi.yaml`
- `api/generated/mobile-api.meta.json`
- `shared/generated-contract/API/generated_APIRequestFactory.js`
- `shared/generated-contract/API/generated_APIModels.js`
- frontend/backend generated re-exports

Runtime route wiring nằm ở:

- `backend/app/src/http/routes.js`

Backend là raw Node HTTP server. Nó không phải Express app.

### Backend

Backend root:

```text
backend/app/
```

Main entry point:

```text
backend/app/src/server.js
```

Các khu vực backend quan trọng:

- `backend/app/src/bootstrap/` - service và handler composition
- `backend/app/src/config/runtime.js` - environment, paths, integrations, constants
- `backend/app/src/http/` - routes, handlers, pagination, HTTP helpers
- `backend/app/src/domain/` - business logic và normalization
- `backend/app/src/lib/` - stores, PDFs, Gmail drafts, Keycloak directory, translation client
- `backend/app/src/integrations/` - Meta webhook integration

Current persistence:

- `backend/app/data/store.json`
- `backend/app/data/pdfs/generated_offers/`
- `backend/app/data/pdfs/payment_documents/`
- `backend/app/data/pdfs/travel_plans/`
- `backend/app/data/pdfs/attachments/`
- `backend/app/data/booking_images/`
- `backend/app/data/booking_person_photos/`
- `content/tours/`
- `content/atp_staff/`
- `content/country_reference_info.json`
- `content/standard_tours/`

PostgreSQL tồn tại trong compose stack cho Keycloak. Dữ liệu booking/tour/content của ứng dụng hiện vẫn là file-backed.

### Frontend

Frontend roots:

- `frontend/pages/`
- `frontend/scripts/`
- `shared/css/`
- `shared/js/`
- `shared/generated/`
- `frontend/Generated/`

Backend workspace pages:

- `bookings.html` - booking list
- `booking.html` - booking detail workspace
- `marketing_tours.html` - tour list
- `marketing_tour.html` - tour editor
- `standard-tours.html` - standard tour list
- `standard-tour.html` - standard tour editor
- `settings.html` - reports and settings
- `traveler-details.html` - traveler-facing details flow

Frontend là browser-native HTML và ES modules. Không có SPA framework.

## 10. Backend features

### Booking Management

Booking là operational record trung tâm.

Các core booking features:

- public booking intake từ website form
- immutable original web form snapshot
- booking-owned persons và travelers
- booking list search, filtering, pagination, sorting
- booking assignment đến Keycloak users
- booking title, destination, style, customer language và currency
- notes
- activities timeline
- booking image và person photos
- read-only WhatsApp/Meta chat timeline gắn với booking
- section-level optimistic concurrency revisions
- traveler details portal support

Các file quan trọng:

- `frontend/pages/bookings.html`
- `frontend/scripts/pages/booking_list.js`
- `frontend/pages/booking.html`
- `frontend/scripts/pages/booking.js`
- `frontend/scripts/booking/persons.js`
- `frontend/scripts/booking/core.js`
- `frontend/scripts/booking/whatsapp.js`
- `backend/app/src/http/handlers/booking_query.js`
- `backend/app/src/http/handlers/booking_core.js`
- `backend/app/src/http/handlers/booking_people.js`
- `backend/app/src/http/handlers/booking_chat.js`
- `backend/app/src/domain/booking_views.js`

Định hướng domain hiện tại cố ý tránh một CRM master-data layer dùng chung cho customers hoặc traveler groups. Persons thuộc về booking.

### Travel Plans

Travel plans là itineraries có cấu trúc và thuộc sở hữu của booking.

Chúng bao gồm:

- title và summary
- ordered days
- day dates, titles, overnight locations, notes
- ordered segments như transport, accommodation, activity, meal, guide, free time, border crossing và other
- images
- attachments
- generated travel-plan PDFs

Các file quan trọng:

- `frontend/scripts/booking/travel_plan.js`
- `frontend/scripts/booking/travel_plan_images.js`
- `frontend/scripts/booking/travel_plan_attachments.js`
- `frontend/scripts/booking/travel_plan_pdfs.js`
- `backend/app/src/http/handlers/booking_travel_plan.js`
- `backend/app/src/http/handlers/booking_travel_plan_images.js`
- `backend/app/src/http/handlers/booking_travel_plan_attachments.js`
- `backend/app/src/domain/travel_plan.js`
- `backend/app/src/lib/travel_plan_pdf.js`

Standard tours là reusable tour definitions:

- được quản lý trực tiếp như reusable travel-plan content
- được lưu độc lập với bookings
- lifecycle gồm draft, published, archived
- published standard tours có thể được áp dụng vào một booking bằng cách copy
- standard tours không live-linked sau khi apply

### Financial Flow

Financial flow tách proposal creation khỏi payment execution.

Proposal/offer area:

- offer currency
- internal và visible detail levels
- trip/day pricing
- additional items
- discounts
- category rules
- tax và totals
- payment terms
- generated offer PDFs
- tạo Gmail draft cho generated offer PDFs
- management approval flow

Payments area:

- payment request documents
- payment received data
- receipt references
- customer receipt documents
- accepted commercial snapshot
- payment-linked generated offer snapshot

Payment kinds:

- `DEPOSIT`
- `INSTALLMENT`
- `FINAL_BALANCE`

Financial state được suy ra từ receipt fields:

- `PENDING` khi receipt data chưa hoàn chỉnh
- `PAID` khi receipt data hoàn chỉnh

Các quy tắc quan trọng:

- offer currency chỉ được edit khi offer còn là draft
- payment documents được generate từ payment flow
- khi commercial snapshot đã được chấp nhận, các payment documents sau đó dùng accepted snapshot
- xóa generated offer không được làm hỏng payment snapshots đang reference đến nó

Các file quan trọng:

- `frontend/scripts/booking/offers.js`
- `frontend/scripts/booking/offer_pricing.js`
- `frontend/scripts/booking/offer_payment_terms.js`
- `frontend/scripts/booking/payment_flow.js`
- `frontend/scripts/booking/pdf_workspace.js`
- `backend/app/src/http/handlers/booking_finance.js`
- `backend/app/src/http/handlers/booking_payment_documents.js`
- `backend/app/src/domain/pricing.js`
- `backend/app/src/domain/accepted_record.js`
- `backend/app/src/domain/generated_offer_artifacts.js`
- `backend/app/src/lib/offer_pdf.js`
- `backend/app/src/lib/payment_document_pdf.js`
- `backend/app/src/lib/gmail_drafts.js`


### Settings Tab

Backend settings page là:

```text
frontend/pages/settings.html
frontend/scripts/pages/settings_list.js
```

Hiện tại chỉ admin mới được truy cập.

Settings features:

- backend activity observability
- các backend-process sessions đang active
- booking được thay đổi gần nhất
- Keycloak-backed staff directory table
- chỉnh sửa ATP staff profile
- upload staff photo
- friendly short name
- public team order
- staff languages và destinations
- public website team visibility
- localized staff position, description và short description
- staff profile translation helpers
- website destination publication controls
- emergency country-reference notes và contacts

Backend/API support:

- `GET /api/v1/settings/observability`
- `GET /api/v1/keycloak_users`
- `GET /api/v1/staff-profiles`
- `PATCH /api/v1/keycloak_users/{username}/staff-profile`
- `POST /api/v1/keycloak_users/{username}/staff-profile/translate-fields`
- `POST /api/v1/keycloak_users/{username}/staff-profile/picture`
- `DELETE /api/v1/keycloak_users/{username}/staff-profile/picture`
- `GET /api/v1/country-reference-info`
- `PATCH /api/v1/country-reference-info`
- ATP staff profile handlers trong `backend/app/src/http/handlers/atp_staff.js`
- country reference handlers trong `backend/app/src/http/handlers/country_reference.js`

Các data files quan trọng:

- `content/atp_staff/staff.json`
- `content/atp_staff/photos/*`
- `content/country_reference_info.json`

Việc lưu staff profiles hoặc destination publication có thể trigger static homepage asset regeneration. Nếu automatic sync thất bại, chạy:

```bash
node scripts/assets/generate_public_homepage_assets.mjs
```

## 11. Integrations

### Keycloak

Keycloak cung cấp authentication, roles và assignment directory.

Backend đọc assignable users từ Keycloak và fallback về last successful in-memory snapshot khi có thể.

Các file chính:

- `backend/app/src/auth.js`
- `backend/app/src/lib/keycloak_directory.js`
- `backend/keycloak-theme/asiatravelplan/`
- `scripts/keycloak/`

### Meta / WhatsApp

Backend có webhook support cho Meta và WhatsApp.

Các environment variables quan trọng:

- `META_WEBHOOK_ENABLED`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WHATSAPP_WEBHOOK_ENABLED`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`

Các file quan trọng:

- `backend/app/src/integrations/meta_webhook.js`
- `backend/app/src/http/handlers/booking_chat.js`
- `frontend/scripts/booking/whatsapp.js`

### Gmail Drafts

Generated offer PDFs có thể được attach vào Gmail drafts.

Các environment variables bắt buộc:

- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- `GOOGLE_IMPERSONATED_EMAIL`

File quan trọng:

- `backend/app/src/lib/gmail_drafts.js`

### Translation

Translation có thể dùng OpenAI và Google fallback path tùy theo environment configuration.

Các environment variables quan trọng:

- `OPENAI_API_KEY`
- `OPENAI_PROJECT_ID`
- `OPENAI_ORGANIZATION_ID`
- `OPENAI_TRANSLATION_MODEL`
- `GOOGLE_TRANSLATE_FALLBACK_ENABLED`

## 12. Secrets, privacy và customer data

Hệ thống này xử lý customer PII và commercial documents.

Dữ liệu nhạy cảm bao gồm:

- customer names, emails, phone numbers
- traveler details
- traveler photos và document images
- booking notes
- payment documents
- generated offer PDFs
- Gmail draft credentials
- Keycloak secrets
- Meta/WhatsApp webhook secrets
- Google service account credentials

Quy tắc:

- không bao giờ commit file `.env` thật
- không bao giờ commit runtime booking data hoặc generated PDFs
- giữ server secrets chỉ trên server hoặc approved secret storage
- giới hạn access bằng Keycloak role
- xem backup archives là dữ liệu nhạy cảm
- xác minh Caddy không expose hidden server files
- dùng HTTPS cho public/staging/production traffic

## 13. Operational checks

Sau khi setup local hoặc deploy, kiểm tra:

```bash
curl -i http://localhost:8787/health
curl -i https://api-staging.asiatravelplan.com/health
```

Các smoke flows phổ biến:

- mở public website
- submit booking form
- đăng nhập backend qua Keycloak
- mở booking list
- mở booking detail
- edit booking owner/title/person/notes
- tạo hoặc edit proposal
- generate offer PDF
- tạo Gmail draft nếu đã configure
- tạo payment request document
- ghi nhận payment received
- generate customer receipt document
- edit travel plan
- generate travel-plan PDF
- edit một tour và upload image
- thay đổi website destination publication
- verify generated homepage tour/team files sau khi thay đổi content
- logout/login

Các server commands phổ biến:

```bash
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs -f backend
docker compose -f docker-compose.staging.yml logs -f keycloak
docker compose -f docker-compose.staging.yml logs -f caddy
```

Với production, dùng production compose file từ `/srv/asiatravelplan`.

## 14. Known limitations và current exceptions

Nhân viên mới nên biết các limitations này trước khi thay đổi hệ thống:

- application data hiện là file-backed, chưa phải database-backed
- PostgreSQL hiện lưu Keycloak data, không phải main booking store
- một số backend routes và runtime behavior vẫn là handwritten
- Meta webhook endpoints là handwritten exceptions
- tour upload behavior có các phần handwritten
- translation workflows vẫn có runtime-specific behavior
- mobile iOS hiện là shell đã rút gọn, chưa phải full booking/tour app
- generated Swift contract files hiện chưa được check in
- production Storage Box backup automation được tài liệu hóa ở mức concept nhưng chưa được triển khai thành concrete script trong repo này

Các limitations này chỉ chấp nhận được khi chúng vẫn được nêu rõ và vẫn aligned với model, API contract và current runtime docs.

## 15. Glossary

- Booking: operational record trung tâm cho một inquiry hoặc chuyến đi của khách hàng.
- Booking person: contact hoặc traveler được lưu bên trong một booking.
- Web form submission: immutable snapshot của website booking request ban đầu.
- Offer/proposal: commercial proposal có thể edit cho một booking.
- Generated offer: frozen offer PDF artifact và snapshot được tạo từ proposal.
- Payment document: request hoặc receipt PDF được generate từ payment flow.
- Accepted commercial snapshot: frozen offer/payment terms được dùng cho các payment documents sau này.
- Travel plan: structured itinerary thuộc sở hữu của booking.
- Standard tour: reusable tour definition được copy vào bookings.
- Tour: marketing catalog item được hiển thị trên public website khi published.
- Country reference: thông tin vận hành theo quốc gia và public destination visibility.
- Backend UI language: ngôn ngữ ATP staff dùng trong backend chrome và authoring.
- Customer content language: ngôn ngữ dùng cho customer-facing content và PDFs.
- Source language: language branch mà staff đang author từ đó.
- Target language: language branch được tạo bởi translation.
- ATP staff profile: public/internal guide profile gắn với Keycloak user.

## 16. Checklist tuần đầu tiên

1. Đọc overview này và [documentation/current_system_map.md](current_system_map.md).
2. Start local stack với `./scripts/local/deploy_local_all.sh`.
3. Mở public site và submit một test booking.
4. Đăng nhập backend qua Keycloak.
5. Trace booking từ website form đến `booking.persons[]`.
6. Đọc `model/root.cue` và `model/api/endpoints.cue`.
7. Tìm generated request factory được một frontend page sử dụng.
8. Edit một staging-safe tour và regenerate homepage assets.
9. Tạo một proposal, generated offer PDF và payment document trong môi trường non-production.
10. Review backup và restore scripts trước khi chạm vào server data.
11. Hỏi project owner bạn nên có production secrets và server permissions nào.
