// api/download.js
// Backend serverless function (chạy trên Vercel)
// Nhiệm vụ: nhận link video Facebook công khai -> trả về link tải HD/SD

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

  if (!isValidFacebookUrl(videoUrl)) {
    return res.status(400).json({ error: 'Link không hợp lệ. Vui lòng dán link Facebook video công khai.' });
  }

  try {
    const html = await fetchFacebookPage(videoUrl);

    if (isLoginWall(html)) {
      return res.status(403).json({
        error: 'Video này yêu cầu đăng nhập hoặc ở chế độ riêng tư. Web chỉ hỗ trợ video công khai.'
      });
    }

    const result = extractVideoLinks(html);

    if (!result.url) {
      return res.status(404).json({
        error: 'Không tìm thấy link video. Có thể Facebook đã đổi cấu trúc trang, hoặc video không công khai.'
      });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Lỗi xử lý:', err);
    return res.status(500).json({ error: 'Lỗi server khi xử lý video. Vui lòng thử lại sau.' });
  }
}

// ---------- Helper functions ----------

function isValidFacebookUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)facebook\.com$|(^|\.)fb\.watch$/.test(u.hostname);
  } catch {
    return false;
  }
}

async function fetchFacebookPage(videoUrl) {
  // mbasic.facebook.com thường trả về HTML đơn giản, ít JS che giấu hơn
  // nên nhiều khi dễ parse hơn bản www. — dùng làm fallback nếu cần
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Facebook trả về lỗi HTTP ${response.status}`);
  }

  return response.text();
}

function isLoginWall(html) {
  // Các dấu hiệu cho thấy Facebook đang yêu cầu đăng nhập
  return (
    html.includes('login_form') ||
    html.includes('"loggedOut":true') ||
    (html.includes('Log into Facebook') && !html.includes('video'))
  );
}

function extractVideoLinks(html) {
  // Danh sách các pattern regex được thử theo thứ tự ưu tiên.
  // Facebook hay đổi cấu trúc -> khi web ngừng hoạt động, đây là nơi cần
  // cập nhật pattern mới (xem ghi chú README đi kèm).
  const hdPatterns = [
    /"browser_native_hd_url":"([^"]+)"/,
    /"playable_url_quality_hd":"([^"]+)"/,
    /hd_src:"([^"]+)"/
  ];

  const sdPatterns = [
    /"browser_native_sd_url":"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /sd_src:"([^"]+)"/
  ];

  const hdUrl = tryPatterns(html, hdPatterns);
  if (hdUrl) {
    return { url: cleanUrl(hdUrl), quality: 'HD' };
  }

  const sdUrl = tryPatterns(html, sdPatterns);
  if (sdUrl) {
    return { url: cleanUrl(sdUrl), quality: 'SD' };
  }

  return { url: null, quality: null };
}

function tryPatterns(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function cleanUrl(rawUrl) {
  return rawUrl
    .replace(/\\\//g, '/')
    .replace(/\\u0025/g, '%')
    .replace(/&amp;/g, '&');
}
