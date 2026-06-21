// api/download.js
// Backend serverless function (chạy trên Vercel)

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
        error: 'Không tìm thấy link. Có thể Facebook đã đổi cấu trúc trang, hoặc đây là video riêng tư/group kín.'
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
    // Bổ sung thêm share/v/ để hợp lệ hóa các link rút gọn
    return /(^|\.)facebook\.com$|(^|\.)fb\.watch$/.test(u.hostname);
  } catch {
    return false;
  }
}

async function fetchFacebookPage(videoUrl) {
  // Thay thế www thành mbasic để lấy giao diện HTML đơn giản, dễ cào dữ liệu Reels hơn
  const targetUrl = videoUrl.replace('www.facebook.com', 'mbasic.facebook.com');

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Facebook trả về lỗi HTTP ${response.status}`);
  }

  return response.text();
}

function isLoginWall(html) {
  return (
    html.includes('login_form') ||
    html.includes('"loggedOut":true') ||
    (html.includes('Log into Facebook') && !html.includes('video'))
  );
}

function extractVideoLinks(html) {
  // Bổ sung pattern video_url cho Reels
  const hdPatterns = [
    /"browser_native_hd_url":"([^"]+)"/,
    /"playable_url_quality_hd":"([^"]+)"/,
    /hd_src:"([^"]+)"/,
    /"video_url":"([^"]+)"/
  ];

  // Bổ sung quét thẻ Meta OG - Vũ khí bắt link siêu chuẩn cho Reels
  const sdPatterns = [
    /"browser_native_sd_url":"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /sd_src:"([^"]+)"/,
    /<meta\s+property="og:video"\s+content="([^"]+)"/i
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
  // Bổ sung thêm \u0026 để giải mã ký tự & trong link Reels
  return rawUrl
    .replace(/\\\//g, '/')
    .replace(/\\u0025/g, '%')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&');
}
