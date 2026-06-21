export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link video' });
  }

  // Danh sách các máy chủ giải mã (Load Balancing)
  const apiServers = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kpnq.dev',
    'https://api.cobalt.my.id',
    'https://cobalt.urlx.net'
  ];

  // Vòng lặp: Thử lần lượt từng máy chủ
  for (let server of apiServers) {
    try {
      const response = await fetch(`${server}/api/json`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({ url: videoUrl })
      });

      const data = await response.json();

      // Nếu máy chủ nào trả về link thành công, xuất kết quả ngay và kết thúc
      if (data && data.url) {
        return res.status(200).json({ url: data.url, quality: 'HD' });
      }
    } catch (error) {
      // Nếu máy chủ này lỗi, code sẽ tự động nhảy sang thử máy chủ tiếp theo
      continue;
    }
  }

  // Nếu tất cả các máy chủ đều bó tay
  return res.status(404).json({ error: 'Không thể tải. Hãy chắc chắn đây là video CÔNG KHAI (có hình trái đất), không phải trong Group kín.' });
}
