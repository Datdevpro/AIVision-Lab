export interface MiniLesson {
  id: string
  title_vi: string
  title_en: string
  short_summary: string
  detailed_explanation: string
  practical_tip: string
  key_questions: string[]
}

export const MINI_LESSONS: Record<string, MiniLesson> = {
  dataset: {
    id: 'dataset',
    title_vi: 'Tập dữ liệu là gì?',
    title_en: 'What is a Dataset?',
    short_summary: 'Tập hợp các hình ảnh mẫu kèm nhãn phân loại mà mô hình AI dùng để học hỏi và tự kiểm tra năng lực.',
    detailed_explanation:
      'Trong thị giác máy tính, một tập dữ liệu (dataset) bao gồm nhiều mẫu hình ảnh đại diện cho thế giới thực. Để đánh giá trung thực, dữ liệu luôn được chia thành hai phần riêng biệt: tập Huấn luyện (Train set) để mô hình cập nhật trọng số, và tập Kiểm định (Validation set) để đo lường xem mô hình có nhận diện được những góc chụp mới chưa từng thấy hay không.',
    practical_tip:
      'Chất lượng quan trọng hơn số lượng thuần túy. Hãy chụp ảnh ở nhiều góc độ, khoảng cách, ánh sáng khác nhau và hậu cảnh đa dạng để mô hình học đúng bản chất của vật thể thay vì ghi nhớ nền nhà.',
    key_questions: [
      'Tại sao không nên để ảnh validation giống hệt ảnh train?',
      'Thế nào là rò rỉ dữ liệu (data leakage)?',
      'Cần tối thiểu bao nhiêu ảnh để train thử nghiệm?',
    ],
  },

  class: {
    id: 'class',
    title_vi: 'Lớp / Nhãn là gì?',
    title_en: 'What is a Class / Label?',
    short_summary: 'Tên danh mục phân loại mà bạn muốn máy tính phân biệt, ví dụ: "Mèo", "Chó", "Bút", "Điện thoại".',
    detailed_explanation:
      'Mỗi lớp (class) đại diện cho một nhóm đối tượng có chung đặc tính. Trong bài toán phân loại nhiều lớp (Multiclass Classification), mô hình sẽ xuất ra một phân phối xác suất cho tất cả các lớp, với tổng xác suất luôn bằng 100%. Lớp có xác suất cao nhất chính là kết quả dự đoán của AI.',
    practical_tip:
      'Các lớp phải loại trừ lẫn nhau rõ ràng. Nếu hai lớp có ngoại hình quá giống nhau (ví dụ: bút bi đen và bút bi xanh khi chụp ở khoảng cách xa), mô hình sẽ rất dễ nhầm lẫn.',
    key_questions: [
      'Tại sao cần ít nhất 2 lớp để huấn luyện?',
      'Xác suất đầu ra (probability) khác gì độ tin cậy tuyệt đối?',
    ],
  },

  epoch: {
    id: 'epoch',
    title_vi: 'Epoch là gì?',
    title_en: 'What is an Epoch?',
    short_summary: 'Một chu kỳ hoàn chỉnh khi mô hình AI đã duyệt qua toàn bộ tất cả hình ảnh trong tập huấn luyện đúng một lần.',
    detailed_explanation:
      'Một epoch (vòng lặp huấn luyện) kết thúc khi tất cả các batch ảnh train đã được đưa qua mạng nơ-ron và trọng số được tinh chỉnh. Huấn luyện qua nhiều epoch giúp mô hình có thêm cơ hội sửa sai và cải thiện độ chính xác. Tuy nhiên, nếu cho học quá nhiều epoch mà dữ liệu ít, mô hình sẽ bắt đầu "học vẹt" (overfitting).',
    practical_tip:
      'Đừng lầm tưởng cứ tăng thật nhiều epoch là mô hình sẽ giỏi hơn. Hãy quan sát đường validation loss: khi train loss vẫn giảm nhưng validation loss bắt đầu ngóc đầu tăng, đó là lúc nên dừng lại.',
    key_questions: [
      'Tại sao 10 epoch có thể tốt hơn 50 epoch?',
      'Làm thế nào để biết thời điểm tối ưu để dừng huấn luyện?',
    ],
  },

  batch: {
    id: 'batch',
    title_vi: 'Batch Size là gì?',
    title_en: 'What is Batch Size?',
    short_summary: 'Số lượng hình ảnh được gom nhóm lại để mô hình xử lý cùng một lúc trước mỗi lần cập nhật trọng số.',
    detailed_explanation:
      'Thay vì tính gradient cho từng ảnh một (rất chậm và nhiễu) hoặc toàn bộ tập dữ liệu cùng lúc (tốn quá nhiều bộ nhớ RAM/VRAM), chúng ta chia dữ liệu thành từng cụm nhỏ gọi là Mini-batch (thường là 8, 16, 32 hoặc 64 ảnh). Mô hình tính trung bình sai số của cả batch rồi mới thực hiện một bước nhảy điều chỉnh trọng số.',
    practical_tip:
      'Với máy tính học đường thông thường hoặc GPU vừa phải, batch size 16 là lựa chọn cân bằng lý tưởng giữa tốc độ và độ mượt mà của hàm mục tiêu.',
    key_questions: [
      'Batch size quá nhỏ thì đường loss sẽ trông như thế nào?',
      'Batch size ảnh hưởng thế nào đến dung lượng bộ nhớ VRAM?',
    ],
  },

  learning_rate: {
    id: 'learning_rate',
    title_vi: 'Tốc độ học (Learning Rate) là gì?',
    title_en: 'What is Learning Rate (LR)?',
    short_summary: 'Kích thước của bước nhảy mà thuật toán tối ưu hóa di chuyển để điều chỉnh các trọng số sau mỗi bước học.',
    detailed_explanation:
      'Learning rate là siêu tham số (hyperparameter) quan trọng bậc nhất trong học sâu. Hãy tưởng tượng bạn đang đi xuống một thung lũng sương mù để tìm điểm thấp nhất (loss nhỏ nhất): nếu bước quá dài (LR quá lớn), bạn sẽ nhảy vọt qua đáy thung lũng và văng ra ngoài; nếu bước quá ngắn (LR quá nhỏ), bạn sẽ mất hàng giờ hoặc kẹt lại ở những hố nông.',
    practical_tip:
      'Với thuật toán Adam và kỹ thuật Transfer Learning, mức 0.001 (1e-3) là điểm khởi đầu chuẩn mực. Nếu thấy đường loss nhảy múa hỗn loạn (NaN hoặc dao động dựng đứng), hãy giảm LR xuống 0.0001.',
    key_questions: [
      'Hiện tượng phát nổ loss (Loss Explosion) là gì?',
      'Tại sao learning rate quá nhỏ lại khiến mô hình học như dậm chân tại chỗ?',
    ],
  },

  optimizer: {
    id: 'optimizer',
    title_vi: 'Bộ tối ưu hóa (Optimizer) là gì?',
    title_en: 'What is an Optimizer?',
    short_summary: 'Chiến lược toán học điều phối việc cập nhật trọng số của mạng nơ-ron dựa trên đạo hàm (gradient).',
    detailed_explanation:
      'Optimizer là người dẫn đường. Thuật toán cổ điển SGD (Stochastic Gradient Descent) bước đều theo hướng dốc nhất, đôi khi kèm xung lượng (momentum) để vượt qua vùng bằng phẳng. Thuật toán hiện đại Adam (Adaptive Moment Estimation) tự động điều chỉnh tốc độ học riêng cho từng tham số dựa trên lịch sử chuyển động.',
    practical_tip:
      'Adam là lựa chọn khuyên dùng hàng đầu cho người mới vì tính thích ứng cao và ít nhạy cảm với việc chọn sai bước khởi đầu so với SGD thuần túy.',
    key_questions: [
      'Adam khác gì SGD với Momentum?',
      'Weight Decay trong optimizer đóng vai trò gì?',
    ],
  },

  hidden_layer: {
    id: 'hidden_layer',
    title_vi: 'Lớp ẩn & Neuron là gì?',
    title_en: 'What are Hidden Layers and Neurons?',
    short_summary: 'Các tầng xử lý trung gian biến đổi thông tin thô từ ảnh thành các khái niệm trừu tượng cấp cao.',
    detailed_explanation:
      'Trong mạng nơ-ron, các lớp nằm giữa đầu vào và đầu ra được gọi là "lớp ẩn" (hidden layers). Mỗi neuron trong lớp này tính tổng có trọng số của các đầu vào rồi đưa qua một hàm kích hoạt phi tuyến. Càng nhiều lớp ẩn và neuron, mạng càng có khả năng mô hình hóa các ranh giới phân loại phức tạp.',
    practical_tip:
      'Khi làm Transfer Learning với ít ảnh mẫu, một lớp ẩn với 64 neuron là đủ mạnh. Thêm quá nhiều lớp dense vào phần đầu phân loại sẽ dễ gây overfitting vì số tham số tăng vọt.',
    key_questions: [
      'Tại sao mạng nhiều lớp hơn chưa chắc đã cho kết quả thực tế tốt hơn?',
      'Sự khác nhau giữa lớp tích chập (Conv) và lớp kết nối đầy đủ (Dense)?',
    ],
  },

  activation: {
    id: 'activation',
    title_vi: 'Hàm kích hoạt là gì?',
    title_en: 'What is an Activation Function?',
    short_summary: 'Phép biến đổi phi tuyến quyết định mức độ "kích hoạt" tín hiệu truyền qua neuron tiếp theo.',
    detailed_explanation:
      'Nếu không có hàm kích hoạt phi tuyến, toàn bộ mạng nơ-ron dù sâu đến đâu cũng chỉ tương đương với một phép nhân ma trận tuyến tính đơn giản (như vẽ một đường thẳng). Các hàm kích hoạt phổ biến bao gồm ReLU (giữ nguyên số dương, triệt tiêu số âm), GELU (mịn hơn, phổ biến trong Transformer hiện đại) và Tanh.',
    practical_tip:
      'ReLU là chuẩn vàng đơn giản và hiệu quả nhất cho hầu hết các tác vụ phân loại hình ảnh.',
    key_questions: [
      'Vấn đề "Dead ReLU" (neuron chết) là gì?',
      'Tại sao hàm phi tuyến là linh hồn của mạng nơ-ron sâu?',
    ],
  },

  transfer_learning: {
    id: 'transfer_learning',
    title_vi: 'Học chuyển giao (Transfer Learning) là gì?',
    title_en: 'What is Transfer Learning?',
    short_summary: 'Tái sử dụng kiến thức thị giác từ một mô hình khổng lồ đã học trước trên hàng triệu ảnh để áp dụng vào bài toán mới.',
    detailed_explanation:
      'Để huấn luyện một mạng nơ-ron thị giác từ số không (from scratch), bạn cần hàng trăm ngàn ảnh và nhiều tuần tính toán. Nhưng với Transfer Learning, chúng ta mượn "đôi mắt" của MobileNetV3 (đã học trên 1.4 triệu ảnh của ImageNet). Phần trích xuất đặc trưng (feature extractor) được đóng băng lại, bạn chỉ cần huấn luyện một đầu phân loại nhỏ bằng vài chục tấm ảnh của mình trong vài giây!',
    practical_tip:
      'Đây chính là bí quyết giúp Google Teachable Machine và Vision Lab AI có thể học nhận diện đồ vật mới tức thì trên trình duyệt hoặc máy tính cá nhân.',
    key_questions: [
      'Tại sao các lớp đầu của mạng trích xuất cạnh và góc, còn các lớp sau trích xuất hình khối?',
      'Đóng băng trọng số (Freeze) có nghĩa là gì trong PyTorch?',
    ],
  },

  overfitting: {
    id: 'overfitting',
    title_vi: 'Hiện tượng Quá khớp (Overfitting) là gì?',
    title_en: 'What is Overfitting?',
    short_summary: 'Khi mô hình học vẹt từng chi tiết nhỏ của tập huấn luyện nhưng hoàn toàn bất lực trước hình ảnh mới trong thực tế.',
    detailed_explanation:
      'Dấu hiệu kinh điển của overfitting là: Training Accuracy đạt 98-100% nhưng Validation Accuracy chỉ lẹt đẹt 50-60%, hoặc Training Loss liên tục giảm trong khi Validation Loss ngóc đầu tăng vọt. Mô hình đã nhớ cả vết bẩn trên bàn, màu tường phía sau thay vì nhớ hình dáng chiếc bút.',
    practical_tip:
      'Cách khắc phục: Bổ sung thêm nhiều ảnh đa dạng; Bật Data Augmentation (xoay, lật, đổi màu); Tăng Dropout; hoặc dùng Early Stopping để ngắt sớm khi validation bắt đầu suy giảm.',
    key_questions: [
      'Làm thế nào để phân biệt Overfitting và Underfitting?',
      'Data Augmentation giúp chống overfitting như thế nào?',
    ],
  },

  confusion: {
    id: 'confusion',
    title_vi: 'Ma trận nhầm lẫn (Confusion Matrix) là gì?',
    title_en: 'What is a Confusion Matrix?',
    short_summary: 'Bảng thống kê trực quan cho biết mô hình đã đoán đúng bao nhiêu lần và bị nhầm lẫn giữa những lớp cụ thể nào.',
    detailed_explanation:
      'Một con số Accuracy tổng thể có thể đánh lừa bạn (ví dụ nếu lớp A có 90 ảnh và lớp B có 10 ảnh, đoán bừa A cũng đạt 90%). Confusion Matrix xếp hàng ngang là nhãn thật (True Label) và cột dọc là nhãn đoán (Predicted Label). Các ô nằm trên đường chéo chính thể hiện số lần dự đoán chính xác; các ô nằm ngoài đường chéo chính vạch trần các cặp đối tượng mà mô hình thường xuyên nhầm lẫn với nhau.',
    practical_tip:
      'Nhìn vào các ô nhầm lẫn cao nhất để biết lớp nào cần chụp thêm ảnh bổ sung hoặc cần kiểm tra xem nhãn có bị gán sai hay không.',
    key_questions: [
      'Precision (Độ chuẩn xác) và Recall (Độ thu hồi) khác nhau thế nào?',
      'Khi nào Accuracy tổng thể trở nên vô nghĩa?',
    ],
  },
}
