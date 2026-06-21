export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link video' });
  }

  try {
    // Thêm 'redirect: follow' để đuổi theo các link dạng /share/
    const response = await fetch(videoUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Mode': 'navigate'
      }
    });
    
    const html = await response.text();

    // Cách 1: Tìm trong chuỗi dữ liệu JSON
    const hdMatch = html.match(/"browser_native_hd_url":"([^"]+)"/) || html.match(/"playable_url_quality_hd":"([^"]+)"/);
    const sdMatch = html.match(/"browser_native_sd_url":"([^"]+)"/) || html.match(/"playable_url":"([^"]+)"/);
    
    // Cách 2 (Dự phòng): Tìm trong thẻ Meta OG (Rất hiệu quả với server bị chặn nhẹ)
    const metaMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i);

    let finalUrl = null;
    let quality = 'SD';

    if (hdMatch && hdMatch[1]) {
        finalUrl = hdMatch[1].replace(/\\\//g, '/').replace(/\\u0025/g, '%');
        quality = 'HD';
    } else if (sdMatch && sdMatch[1]) {
        finalUrl = sdMatch[1].replace(/\\\//g, '/').replace(/\\u0025/g, '%');
    } else if (metaMatch && metaMatch[1]) {
        // Giải mã các ký tự HTML (ví dụ &amp; thành &)
        finalUrl = metaMatch[1].replace(/&amp;/g, '&');
    }

    if (!finalUrl) {
       return res.status(404).json({ error: 'Không thể trích xuất. Video có thể bị giới hạn hoặc FB đang chặn IP quét.' });
    }

    return res.status(200).json({ url: finalUrl, quality: quality });

  } catch (error) {
    return res.status(500).json({ error: 'Lỗi máy chủ khi quét dữ liệu' });
  }
}
