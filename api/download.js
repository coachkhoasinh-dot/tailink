export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link video' });
  }

  try {
    // Gọi thẳng vào API chuyên dụng giải mã Facebook
    const response = await fetch('https://fdown.isuru.eu.org/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: videoUrl,
        quality: 'best'
      })
    });
    
    const data = await response.json();

    // Nếu API trả về lỗi hoặc không có link tải
    if (!response.ok || !data.download_url) {
       return res.status(404).json({ error: 'Không thể giải mã. Video có thể bị giới hạn quyền riêng tư!' });
    }

    // Trả link mp4 xịn về cho giao diện
    return res.status(200).json({ url: data.download_url, quality: 'HD' });

  } catch (error) {
    return res.status(500).json({ error: 'Máy chủ giải mã đang quá tải, vui lòng thử lại sau!' });
  }
}
