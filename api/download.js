// api/download.js
// Backend xử lý tải video YouTube

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link video.' });
  }

  // Kiểm tra chặn nếu không phải link YouTube
  if (!/(youtube\.com|youtu\.be)/.test(videoUrl)) {
    return res.status(400).json({ error: 'Link không hợp lệ. Vui lòng nhập link YouTube.' });
  }

  // Danh sách máy chủ dự phòng chuyên trị YouTube
  const apiServers = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kpnq.dev',
    'https://api.cobalt.my.id',
    'https://cobalt.urlx.net'
  ];

  for (let server of apiServers) {
    try {
      const response = await fetch(`${server}/api/json`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify({
          url: videoUrl,
          vQuality: "720" // Ưu tiên 720p để đảm bảo file luôn có cả hình và tiếng
        })
      });

      const data = await response.json();

      if (data && data.url) {
        return res.status(200).json({ url: data.url, quality: 'MP4' });
      }
    } catch (error) {
      continue; // Nếu lỗi, tự động đổi máy chủ
    }
  }

  return res.status(404).json({ error: 'Không thể tải. Video có thể bị giới hạn độ tuổi hoặc bản quyền.' });
}
