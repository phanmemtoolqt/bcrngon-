# 🎰 Baccarat Live API

API server để lấy dữ liệu Baccarat realtime.

## 🚀 Deploy lên GitHub

1. Fork repository này
2. Vào Settings > Secrets > Actions
3. Thêm các secrets:
   - `tiendatoce1232`: Tài khoản đăng nhập
   - `tiendatoceee1`: Mật khẩu
   - `BASE_URL`: URL website (mặc định: https://aibcr.me)

4. Vào Actions > Enable workflows
5. Push code lên nhánh main để trigger

## 📡 API Endpoints

- `GET /api/baccarat` - Tất cả bàn
- `GET /api/baccarat/:table` - Bàn cụ thể
- `GET /api/latest` - 10 bàn mới nhất
- `GET /health` - Kiểm tra trạng thái

## ⚠️ Lưu ý

- GitHub Actions chỉ chạy tối đa 6 tiếng
- Server sẽ tự động restart mỗi 4 tiếng
- Không commit credentials lên repo
