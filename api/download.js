// api/download.js
// Backend xử lý tải video YouTube - Phiên bản nâng cao (Thay thế code cũ hoàn toàn)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Lấy tham số từ URL
  const videoUrl = req.query.url;
  const quality = req.query.quality || '720';
  const format = req.query.format || 'mp4';
  const audioOnly = req.query.audioOnly === 'true';
  const audioFormat = req.query.audioFormat || 'mp3';

  // Kiểm tra link
  if (!videoUrl) {
    return res.status(400).json({ 
      success: false,
      error: 'Vui lòng cung cấp link video.' 
    });
  }

  if (!/(youtube\.com|youtu\.be)/.test(videoUrl)) {
    return res.status(400).json({ 
      success: false,
      error: 'Link không hợp lệ. Vui lòng nhập link YouTube.' 
    });
  }

  // Danh sách máy chủ dự phòng
  const apiServers = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kpnq.dev',
    'https://api.cobalt.my.id',
    'https://cobalt.urlx.net'
  ];

  let errors = [];

  // Thử từng server
  for (let server of apiServers) {
    try {
      // Xây dựng request body với nhiều tùy chọn
      const requestBody = {
        url: videoUrl,
        vQuality: quality,
        isAudioOnly: audioOnly,
        audioFormat: audioFormat,
        filenamePattern: 'classic',
        disableMetadata: false
      };

      // Thêm tùy chọn format nếu không phải audio only
      if (!audioOnly) {
        requestBody.vCodec = format === 'webm' ? 'vp9' : 'h264';
        requestBody.aFormat = audioFormat === 'mp3' ? 'mp3' : 'm4a';
      }

      const response = await fetch(`${server}/api/json`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data && data.url) {
        // Lấy tên file thông minh
        let fileName = await getFileName(videoUrl, audioOnly, audioFormat, format);
        
        return res.status(200).json({
          success: true,
          data: {
            url: data.url,
            quality: quality,
            format: audioOnly ? audioFormat : format,
            isAudioOnly: audioOnly,
            fileName: fileName,
            title: await getVideoTitle(videoUrl)
          },
          message: `Đang tải ${audioOnly ? 'âm thanh' : 'video'} chất lượng ${quality}p`
        });
      }
    } catch (error) {
      errors.push({ server, error: error.message });
      continue;
    }
  }

  // Nếu tất cả thất bại
  return res.status(404).json({
    success: false,
    error: 'Không thể tải video. Video có thể bị giới hạn độ tuổi hoặc bản quyền.',
    details: errors,
    suggestions: [
      'Kiểm tra lại link video',
      'Thử chất lượng thấp hơn (vd: 360)',
      'Thử tải chỉ âm thanh (audioOnly=true)',
      'Video có thể yêu cầu đăng nhập hoặc bị giới hạn khu vực'
    ]
  });
}

// === HÀM HỖ TRỢ ===

// Lấy tên file
async function getFileName(videoUrl, audioOnly, audioFormat, format) {
  try {
    const videoId = extractVideoId(videoUrl);
    const title = await getVideoTitle(videoId);
    const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').trim().slice(0, 50);
    
    if (audioOnly) {
      return `${cleanTitle}.${audioFormat}`;
    }
    return `${cleanTitle}.${format}`;
  } catch (error) {
    return `video_${Date.now()}.${audioOnly ? audioFormat : format}`;
  }
}

// Trích xuất video ID
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
    /(?:youtube\.com\/embed\/)([\w-]+)/
  ];
  
  for (let pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Lấy tiêu đề video
async function getVideoTitle(videoId) {
  if (!videoId) return 'video';
  
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const data = await response.json();
    return data.title || 'video';
  } catch (error) {
    return 'video';
  }
}
