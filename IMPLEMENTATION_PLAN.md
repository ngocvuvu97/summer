# Kế hoạch MVP — ghi nhận hand bài

> Ghi chú ngữ nghĩa: **số lá** ở đây là **số lá thừa/dư (chênh lệch)** — không phải số lá thua.
> Người thắng nhận lá dư (giá trị **+**), người thua trả lá (giá trị **−**).
> Vì vậy tổng của mỗi row **phải bằng 0** để ván được cân đối.

## Mục tiêu

- Tạo app mobile web để ghi số lá thừa/dư (chênh lệch) của từng người chơi qua các ván trong một buổi chơi.
- Mỗi ván (mỗi row) phải cân đối: tổng các giá trị trong row = 0.
- Không cần login, backend, hoặc tài khoản.
- Dữ liệu lưu trong `localStorage` của trình duyệt.

## Yêu cầu giao diện

- Hiển thị title app `Hand bài` ở phía trên bảng.
- Nút `Ván mới` nằm ngay dưới title.
- Không hiển thị thông tin `BUỔI CHƠI`, số ván, ngày bắt đầu hoặc dòng `Tổng mỗi ván = 0`.
- Hàng tiêu đề chỉ hiển thị tên người chơi, tổng tích lũy và cột thao tác cuối có dấu `+`.
- Nút `+` nằm ở cuối cùng của hàng tiêu đề để thêm người chơi mới.
- Chạm vào tên người chơi để sửa trực tiếp, nhấn Enter hoặc click ra ngoài để lưu.
- Row bình thường và row đã xác nhận dùng background trắng.
- Row đang nhập nhưng tổng khác 0 dùng background phân biệt để nhận biết.
- Nút xác nhận là `OK`, nằm trong cột thao tác cuối và thẳng hàng với nhau; cột này dùng chung vị trí với dấu `+` ở hàng tiêu đề.
- Không hiển thị message validate.
- Các row liền nhau, không có khoảng trống thừa.

## Luồng chính

- Mở app → khôi phục session hoặc tạo mới.
- Nhập số có dấu cho từng người chơi: số dương là nhận lá dư, số âm là trả lá.
- Nếu tổng row = 0 thì cho phép bấm `OK`.
- Row toàn `0` không được xác nhận; ô trống được tính là `0`.
- Chỉ chấp nhận số nguyên trong khoảng `-999` đến `999`. Row có tổng khác `0` dùng trạng thái màu khác và không cho xác nhận.
- Khi `OK` được bấm, row sẽ khóa lại và tạo row mới ở đầu danh sách.
- Mọi thay đổi tự lưu vào `localStorage`, bao gồm cả row đang nhập dở.
- Có nút `Ván mới`; thao tác này yêu cầu xác nhận trước khi xóa session hiện tại và tạo lại 4 người chơi mặc định.

## Quy tắc dữ liệu

- Bắt đầu với 4 người chơi mặc định: `Mem1`, `Mem2`, `Mem3`, `Mem4`.
- Session gồm `version`, thời gian bắt đầu, danh sách người chơi, các row đã xác nhận và một draft.
- Mỗi row chứa giá trị theo từng người chơi và thời gian xác nhận. Tổng row được tính từ các giá trị, không lưu trùng.
- Row đã xác nhận không sửa tiếp.
- Row đang nhập là bản nháp và được lưu để khôi phục sau reload.
- Thêm người chơi tạo tên mặc định tiếp theo (`Mem5`, ...), thêm cột giá trị `0` vào toàn bộ row cũ và draft; tổng lịch sử không thay đổi.
- Nếu dữ liệu `localStorage` thiếu, sai schema hoặc không đọc được, app tạo session mới thay vì hiển thị màn hình trắng.

## Tiêu chí hoàn thành

- App chạy trực tiếp như static site trên GitHub Pages, không cần backend hoặc tài khoản.
- Layout mobile ưu tiên vừa viewport, không tạo scroll ngang; cột co giãn, tên dài được cắt gọn và nút `OK` vẫn thẳng hàng.
- Row đã xác nhận không thể sửa, draft tự lưu và được khôi phục sau reload.
- Chỉ row có ít nhất một giá trị khác `0` và tổng bằng `0` mới được xác nhận.
- Thêm/sửa người chơi và bắt đầu session mới hoạt động mà không làm mất dữ liệu ngoài thao tác được xác nhận.

## Chú ý triển khai

- App chạy tĩnh trên GitHub Pages.
- Không dùng backend, Firebase, Supabase.
- Triển khai bằng `index.html`, `styles.css` và `app.js`; không yêu cầu framework hoặc build step.
- Duy trì thiết kế mobile, không cuộn ngang.
- `localStorage` chỉ lưu trên trình duyệt hiện tại, không đồng bộ giữa thiết bị.
