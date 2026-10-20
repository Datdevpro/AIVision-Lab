# Kế hoạch deploy

Ngày cập nhật: 20/10/2026.

Mục tiêu: cho khoảng 15 học sinh thực hành trên 15 PC và training mô hình riêng cùng lúc, tận dụng tài nguyên của từng PC, không trả phí dịch vụ cho bên thứ ba. Chi phí điện, Internet và phần cứng hiện có vẫn do người tổ chức cung cấp.

Hai hướng dưới đây đang ở mức đề xuất. Hệ thống hiện tại vẫn training trên backend và chỉ cho phép một phiên training chạy tại một thời điểm.

## Hướng 1 Training trực tiếp trong trình duyệt

Học sinh mở một đường link đến Vision-Lab. Giao diện và mô hình học sẵn được tải xuống; việc training và dự đoán chạy trên PC của từng học sinh bằng TensorFlow.js. Máy chủ của giáo viên phục vụ ứng dụng và có thể nhận kết quả bài thực hành.

15 PC chạy 15 phiên training độc lập. Tốc độ phụ thuộc CPU, GPU, RAM và trình duyệt của từng PC.

### Công việc cần thực hiện

1. Xây engine training trong trình duyệt, kết nối với các nút bắt đầu, dừng và phần hiển thị epoch, loss, accuracy, sơ đồ neuron.
2. Chọn mô hình học sẵn tương thích TensorFlow.js cho Beginner và Intermediate; xây CNN tùy chỉnh cho Advanced. Kiểm chứng kiến trúc, tiền xử lý và kết quả thay vì giả định giống hoàn toàn engine PyTorch hiện tại.
3. Triển khai chia dữ liệu, augmentation, training, validation và dự đoán trên máy học sinh; giữ giao diện phản hồi được trong lúc tính toán.
4. Bổ sung lưu và mở lại bài thực hành trên máy học sinh, tải mô hình và kết quả xuống. Xác định định dạng xuất phù hợp với engine trình duyệt; checkpoint PyTorch `.pt` hiện tại không tự động dùng được với engine mới.
5. Nếu cần quản lý lớp tập trung, thêm tài khoản học sinh, quyền sở hữu dự án và chức năng nộp kết quả cho giáo viên.
6. Cung cấp HTTPS khi truy cập từ máy khác để dùng webcam. Đóng gói các thư viện và trọng số cần thiết để giảm phụ thuộc vào dịch vụ tải tài nguyên bên ngoài.
7. Kiểm thử trên 15 PC thật, bao gồm máy cấu hình thấp, hủy training, tải lại trang và phục hồi bài thực hành.

### Ưu điểm

- Học sinh chỉ cần trình duyệt và đường link, không cài Python/PyTorch.
- Tận dụng tài nguyên 15 PC để training cùng lúc.
- Giảm tải tính toán và lưu lượng webcam trên máy giáo viên.
- Có thể phục vụ phần giao diện từ máy giáo viên trong LAN hoặc một nơi host website tĩnh phù hợp.

### Hạn chế

- Cần thay đổi lớn vì phải xây thêm engine thay cho luồng training PyTorch hiện tại.
- Hiệu năng và khả năng tăng tốc phụ thuộc trình duyệt, driver và phần cứng.
- Cần kiểm tra lại cả ba chế độ, augmentation, metric và định dạng xuất mô hình.
- Khi chạy từ bộ nhớ trình duyệt, cần có cơ chế lưu rõ ràng để tránh mất bài khi đóng tab hoặc xóa dữ liệu trình duyệt.

Phù hợp khi ưu tiên trải nghiệm mở link là dùng được và có thời gian phát triển, kiểm thử engine mới.

## Hướng 2 Chạy Vision-Lab cục bộ trên từng PC

Mỗi PC học sinh chạy một bản Vision-Lab với backend PyTorch riêng. Học sinh mở ứng dụng tại `localhost`; ảnh, mô hình và training được xử lý trên chính PC đó.

15 PC chạy 15 phiên training độc lập, mỗi PC một phiên. Có thể bổ sung máy chủ giáo viên để quản lý lớp và nhận kết quả mà không tập trung việc training về máy giáo viên.

### Công việc cần thực hiện

1. Đóng gói bộ cài cho hệ điều hành của phòng máy, gồm frontend đã build, Python runtime, thư viện backend và trình khởi động. Xác minh bộ cài chạy được trên máy sạch, không dựa vào môi trường phát triển hiện tại.
2. Chuẩn bị sẵn trọng số pretrained và các dependency trước buổi học. Có đường chạy bằng CPU; kiểm tra riêng khả năng dùng GPU trên các máy có hỗ trợ.
3. Tạo shortcut khởi động một lần nhấn, tự mở ứng dụng tại `localhost`, kiểm tra backend sẵn sàng và ghi log dễ tìm.
4. Lưu dữ liệu riêng trên từng PC; bổ sung xuất, nhập và sao lưu bài thực hành để học sinh có thể đổi máy hoặc nộp bài.
5. Nếu cần quản lý tập trung, bổ sung đăng nhập và đồng bộ kết quả từ bản cục bộ đến máy chủ giáo viên. Quy định rõ đồng bộ metric, mô hình hay cả ảnh; kiểm tra quyền truy cập dữ liệu trên máy chủ.
6. Chuẩn bị cách cập nhật đồng loạt 15 máy, có số phiên bản và giữ nguyên dữ liệu học sinh khi cập nhật.
7. Kiểm thử đồng thời trên 15 PC, gồm các chế độ Beginner, Intermediate, Advanced, webcam, xuất mô hình và khởi động lại ứng dụng.

### Ưu điểm

- Giữ engine PyTorch và các hành vi training hiện tại.
- Tận dụng tài nguyên từng PC, không cần máy chủ giáo viên gánh 15 phiên training.
- Có thể thực hành độc lập sau khi đã chuẩn bị đủ phần mềm và trọng số.
- Truy cập bằng `localhost` phù hợp với việc xin quyền webcam trong trình duyệt.

### Hạn chế

- Cần cài đặt và bảo trì phần mềm trên 15 PC.
- Bộ cài tương đối lớn; khác biệt hệ điều hành và driver cần được kiểm tra.
- Học sinh đổi máy cần mang theo bài hoặc dùng cơ chế đồng bộ.
- Nếu cần quan sát toàn lớp và thu bài tập trung, phải phát triển thêm chức năng này.

Phù hợp khi ưu tiên giữ đầy đủ engine PyTorch hiện tại và phòng máy cho phép cài đặt phần mềm trước buổi học.

## So sánh để lựa chọn

| Tiêu chí | Training trong trình duyệt | Vision-Lab cục bộ trên từng PC |
|---|---|---|
| Nơi training | Trình duyệt của học sinh | Backend PyTorch trên PC học sinh |
| Training đồng thời 15 PC | Có, dùng tài nguyên từng PC | Có, dùng tài nguyên từng PC |
| Cài đặt trên PC học sinh | Không cần Python/PyTorch | Cần bộ cài/runtime |
| Mức thay đổi engine | Lớn | Giữ engine hiện tại |
| Định dạng mô hình | Cần xác định cho engine trình duyệt | Giữ luồng xuất PyTorch/ONNX hiện tại |
| Quản lý tập trung | Cần thêm chức năng lớp học | Cần thêm đồng bộ và chức năng lớp học |
| Phí dịch vụ bên thứ ba | Có thể bằng 0 khi tự phục vụ tài nguyên | Có thể bằng 0 khi dùng PC hiện có |

Ưu tiên hướng 1 nếu yêu cầu bắt buộc là học sinh chỉ mở một đường link. Ưu tiên hướng 2 nếu cần giữ nguyên nền tảng PyTorch và có quyền cài phần mềm trên 15 máy.

## Điều kiện nghiệm thu chung

- 15 học sinh bắt đầu và hoàn tất 15 phiên training riêng cùng lúc trên PC của mình.
- Dự án, ảnh và mô hình của các học sinh được tách biệt.
- Cả ba chế độ, augmentation, webcam và lưu kết quả hoạt động đúng trong phạm vi đã triển khai.
- Lỗi hiển thị rõ trên giao diện và trong log; có thể khởi động lại hoặc mở lại bài theo cơ chế lưu đã chọn.
- Đo thời gian training, bộ nhớ và độ phản hồi trên các PC thực tế trước khi dùng trong tiết học.
- Không phát sinh dịch vụ hosting, API hoặc GPU cloud trả phí trong phương án được chọn.

## Tài liệu tham khảo

- [TensorFlow.js — xây dựng và training mô hình trong trình duyệt](https://www.tensorflow.org/js).
- [TensorFlow.js — transfer learning](https://www.tensorflow.org/js/tutorials/transfer/what_is_transfer_learning).
- [MDN — yêu cầu secure context khi sử dụng webcam](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
