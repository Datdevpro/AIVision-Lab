"""Specification of every training control: Vietnamese name, explanation, range, default, tooltip,
trade-off. The frontend renders its controls from this list so UI and validation never disagree."""
from __future__ import annotations

from typing import Any

from app.schemas.training_config import (
    ALLOWED_FILTERS,
    ADVANCED_PARAMS,
    BEGINNER_PARAMS,
    INTERMEDIATE_PARAMS,
    TrainingConfig,
)


def _modes(key: str) -> list[str]:
    modes = []
    if key in BEGINNER_PARAMS:
        modes.append("beginner")
    if key in INTERMEDIATE_PARAMS:
        modes.append("intermediate")
    if key in ADVANCED_PARAMS:
        modes.append("advanced")
    return modes


_D = TrainingConfig()

_SPECS: list[dict[str, Any]] = [
    dict(key="epochs", name_vi="Số epoch", name_en="Epochs", type="int", min=1, max=50, step=1, default=_D.epochs,
         description="Một epoch là một lượt mô hình xem toàn bộ ảnh train.",
         tooltip="Nhiều epoch cho mô hình thêm cơ hội học nhưng cũng dễ ghi nhớ dữ liệu (overfitting). Hãy quan sát đường validation loss.",
         tradeoff_low="Ít epoch: huấn luyện nhanh nhưng mô hình có thể chưa học đủ (underfitting).",
         tradeoff_high="Nhiều epoch: tốn thời gian hơn và có thể overfitting; validation có thể không tốt hơn.",
         lesson="epoch"),
    dict(key="val_split", name_vi="Tỉ lệ validation", name_en="Validation split", type="float", min=0.1, max=0.5, step=0.05, default=_D.val_split,
         description="Phần ảnh được giữ lại để kiểm tra, mô hình không học trực tiếp từ chúng.",
         tooltip="Chỉ áp dụng khi chia ngẫu nhiên. Ảnh được chia TRƯỚC khi augmentation để tránh rò rỉ dữ liệu.",
         tradeoff_low="Ít validation: nhiều dữ liệu học hơn nhưng phép đo kém tin cậy.",
         tradeoff_high="Nhiều validation: đo đáng tin hơn nhưng còn ít ảnh để huấn luyện.",
         lesson="dataset"),
    dict(key="split_strategy", name_vi="Cách chia validation", name_en="Split strategy", type="enum", default=_D.split_strategy,
         options=[{"value": "random", "label": "Ngẫu nhiên từ ảnh train"}, {"value": "explicit", "label": "Validation riêng (đã gán)"}],
         description="Ngẫu nhiên: tự tách một phần ảnh train. Validation riêng: dùng các ảnh bạn đã gán là validation.",
         tooltip="Ảnh webcam chụp liên tiếp rất giống nhau, nên chia ngẫu nhiên có thể cho validation quá lạc quan. Chụp phiên riêng cho validation sẽ đáng tin hơn.",
         tradeoff_low="", tradeoff_high="", lesson="overfitting"),
    dict(key="augmentation", name_vi="Tăng cường dữ liệu", name_en="Data augmentation", type="bool", default=_D.augmentation,
         description="Biến đổi nhẹ ảnh train (lật ngang, xoay, đổi màu) mỗi lần xem.",
         tooltip="Chỉ áp dụng cho tập train, không áp dụng cho validation/test. Bật augmentation làm mỗi epoch chậm hơn vì phải tính lại đặc trưng.",
         tradeoff_low="Tắt: nhanh hơn (đặc trưng được tính một lần) nhưng dễ overfitting với ít ảnh.",
         tradeoff_high="Bật: thường giúp tổng quát hóa tốt hơn với ít ảnh, nhưng huấn luyện chậm hơn.",
         lesson="overfitting"),
    dict(key="batch_size", name_vi="Batch size", name_en="Batch size", type="int", min=2, max=64, step=2, default=_D.batch_size,
         description="Số ảnh xử lý cùng lúc trước mỗi lần cập nhật trọng số.",
         tooltip="Batch nhỏ cập nhật thường xuyên nhưng nhiễu hơn; batch lớn mượt hơn và dùng nhiều bộ nhớ hơn.",
         tradeoff_low="Batch nhỏ: nhiều bước cập nhật, đường loss nhiễu hơn.",
         tradeoff_high="Batch lớn: ổn định hơn nhưng ít bước cập nhật mỗi epoch.", lesson="batch"),
    dict(key="learning_rate", name_vi="Learning rate", name_en="Learning rate", type="float", min=1e-5, max=0.1, step=None, scale="log", default=_D.learning_rate,
         description="Mỗi lần cập nhật, trọng số được điều chỉnh bao nhiêu.",
         tooltip="Quá nhỏ: học rất chậm. Quá lớn: loss dao động hoặc không giảm. Giá trị thường dùng với Adam: 0.001.",
         tradeoff_low="Nhỏ: ổn định nhưng chậm, có thể cần nhiều epoch.",
         tradeoff_high="Lớn: học nhanh hơn nhưng có thể dao động hoặc phân kỳ.", lesson="learning_rate"),
    dict(key="optimizer", name_vi="Optimizer", name_en="Optimizer", type="enum", default=_D.optimizer,
         options=[{"value": "adam", "label": "Adam"}, {"value": "sgd", "label": "SGD (momentum 0.9)"}],
         description="Thuật toán quyết định cách cập nhật trọng số dựa trên gradient.",
         tooltip="Adam tự điều chỉnh bước học và thường dễ dùng. SGD đơn giản hơn, thường cần learning rate lớn hơn.",
         tradeoff_low="", tradeoff_high="", lesson="optimizer"),
    dict(key="weight_decay", name_vi="Weight decay", name_en="Weight decay (L2)", type="float", min=0.0, max=0.1, step=0.0005, default=_D.weight_decay,
         description="Phạt các trọng số quá lớn để mô hình đơn giản hơn.",
         tooltip="Là một dạng regularization giúp giảm overfitting. Giá trị nhỏ thường dùng: 0.0001–0.01.",
         tradeoff_low="Thấp/0: mô hình tự do khớp dữ liệu hơn.",
         tradeoff_high="Cao: hạn chế overfitting nhưng có thể làm mô hình học chưa đủ.", lesson="overfitting"),
    dict(key="dropout", name_vi="Dropout", name_en="Dropout", type="float", min=0.0, max=0.8, step=0.05, default=_D.dropout,
         description="Ngẫu nhiên tắt một phần neuron khi huấn luyện để tránh phụ thuộc vào vài neuron.",
         tooltip="Chỉ hoạt động khi huấn luyện (không dùng khi dự đoán). Vì vậy training accuracy đo trong lúc train có thể thấp hơn validation.",
         tradeoff_low="Thấp: ít regularization.", tradeoff_high="Cao: giảm overfitting nhưng có thể học chậm/underfit.", lesson="overfitting"),
    dict(key="dense_layers", name_vi="Số lớp dense ẩn", name_en="Hidden dense layers", type="int", min=0, max=3, step=1, default=_D.dense_layers,
         description="Số lớp fully-connected trong phần classification head (0 = chỉ một lớp tuyến tính).",
         tooltip="Nhiều lớp ẩn giúp biểu diễn phức tạp hơn nhưng cần nhiều dữ liệu hơn để không overfitting.",
         tradeoff_low="Ít lớp: đơn giản, ít tham số.", tradeoff_high="Nhiều lớp: linh hoạt hơn, dễ overfitting với ít ảnh.", lesson="hidden_layer"),
    dict(key="neurons", name_vi="Số neuron mỗi lớp", name_en="Neurons per layer", type="int", min=8, max=512, step=8, default=_D.neurons,
         description="Độ rộng của mỗi lớp dense ẩn.",
         tooltip="Tăng số neuron làm tăng số tham số cần học. Không có nghĩa là luôn chính xác hơn.",
         tradeoff_low="Ít neuron: nhẹ, nhanh.", tradeoff_high="Nhiều neuron: biểu diễn phong phú hơn, nhiều tham số hơn.", lesson="hidden_layer"),
    dict(key="activation", name_vi="Hàm kích hoạt", name_en="Activation function", type="enum", default=_D.activation,
         options=[{"value": "relu", "label": "ReLU"}, {"value": "gelu", "label": "GELU"}, {"value": "tanh", "label": "Tanh"}],
         description="Hàm phi tuyến áp dụng sau mỗi lớp ẩn, giúp mạng học được quan hệ phức tạp.",
         tooltip="ReLU đơn giản và phổ biến, GELU mượt hơn, Tanh cho đầu ra trong khoảng (−1, 1).",
         tradeoff_low="", tradeoff_high="", lesson="activation"),
    dict(key="seed", name_vi="Random seed", name_en="Random seed", type="int", min=0, max=2147483647, step=1, default=_D.seed,
         description="Số khởi tạo cho ngẫu nhiên: cùng seed và cùng dữ liệu cho kết quả gần giống nhau.",
         tooltip="Đổi seed để kiểm tra kết quả có ổn định không. Thay đổi seed cũng thay đổi cách chia train/validation ngẫu nhiên.",
         tradeoff_low="", tradeoff_high="", lesson=None),
    dict(key="early_stopping_patience", name_vi="Early stopping (kiên nhẫn)", name_en="Early stopping patience", type="int", min=0, max=10, step=1, default=_D.early_stopping_patience,
         description="Dừng sớm nếu validation không cải thiện sau số epoch này (0 = tắt).",
         tooltip="Giúp tiết kiệm thời gian và giảm overfitting. Checkpoint tốt nhất luôn được giữ lại.",
         tradeoff_low="", tradeoff_high="", lesson="overfitting"),
    dict(key="conv_blocks", name_vi="Số khối convolution", name_en="Convolution blocks", type="int", min=1, max=4, step=1, default=_D.conv_blocks,
         description="Mỗi khối gồm Conv3×3 → BatchNorm → Activation → MaxPool.",
         tooltip="Mạng sâu hơn học đặc trưng phức tạp hơn nhưng cần nhiều dữ liệu hơn vì học từ đầu.",
         tradeoff_low="Ít khối: nhẹ, đặc trưng đơn giản.", tradeoff_high="Nhiều khối: biểu diễn mạnh hơn, nhiều tham số hơn.", lesson="hidden_layer"),
    dict(key="conv_filters", name_vi="Số filter mỗi khối", name_en="Filters per block", type="int_list", options=list(ALLOWED_FILTERS), default=_D.conv_filters,
         description="Số bộ lọc (filter) trong từng khối convolution.",
         tooltip="Nhiều filter học được nhiều mẫu hình khác nhau hơn nhưng tăng số tham số.",
         tradeoff_low="", tradeoff_high="", lesson="hidden_layer"),
]

PARAM_SPECS: list[dict[str, Any]] = [{**s, "modes": _modes(s["key"])} for s in _SPECS]

MODES: list[dict[str, Any]] = [
    dict(id="beginner", name_vi="Khám phá AI", name_en="Beginner", enabled=True,
         description="Huấn luyện bộ phân loại ảnh với rất ít thiết lập. Dùng MobileNetV3-Small đã học sẵn từ ImageNet (đóng băng) và chỉ huấn luyện một đầu phân loại mới.",
         architecture="Transfer learning: backbone đóng băng + head nhỏ (1 lớp ẩn 64 neuron, ReLU)"),
    dict(id="intermediate", name_vi="Phòng thí nghiệm AI", name_en="Intermediate", enabled=True,
         description="Tinh chỉnh siêu tham số và cấu trúc classification head. Backbone MobileNetV3-Small vẫn đóng băng.",
         architecture="Transfer learning: backbone đóng băng + head tuỳ chỉnh"),
    dict(id="advanced", name_vi="Neural Network Architect", name_en="Advanced", enabled=True,
         description="Tự thiết kế một CNN nhỏ và huấn luyện TỪ ĐẦU (không dùng trọng số pretrained). Thường cần nhiều ảnh hơn nhiều so với transfer learning.",
         architecture="Custom CNN từ đầu (ảnh 64×64), giới hạn kích thước an toàn"),
]
