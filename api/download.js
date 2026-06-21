export default async function handler(req, res) {
  // Cho phép trình duyệt gọi API mà không bị lỗi bảo mật CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link video' });
  }

  try {
    // Sử dụng Cobalt API: Chuyên gia "vượt rào" mọi nền tảng
    const response = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        url: videoUrl,
        filenamePattern: "classic" // Giữ tên file gọn gàng
      })
    });
    
    const data = await response.json();

    // Kiểm tra nếu API báo lỗi hoặc không trả về link
    if (data.status === 'error' || !data.url) {
       return res.status(404).json({ error: 'Video riêng tư hoặc API giải mã đang bảo trì. Hãy thử link khác!' });
    }

    // Trả kết quả thành công về cho trang web của bạn
    return res.status(200).json({ url: data.url, quality: 'HD' });

  } catch (error) {
    return res.status(500).json({ error: 'Máy chủ giải mã đang quá tải, vui lòng thử lại sau!' });
  }
}
