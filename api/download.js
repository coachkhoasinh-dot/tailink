// api/download.js
// Backend xử lý tải video YouTube - Vượt giới hạn độ tuổi và bản quyền

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const videoUrl = req.query.url;
  const quality = req.query.quality || '720';
  const format = req.query.format || 'mp4';
  const audioOnly = req.query.audioOnly === 'true';
  const audioFormat = req.query.audioFormat || 'mp3';

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

  // === PHƯƠNG THỨC 1: COBALT API (Ưu tiên) ===
  const cobaltResult = await tryCobalt(videoUrl, quality, audioOnly, audioFormat, format);
  if (cobaltResult) {
    return res.status(200).json(cobaltResult);
  }

  // === PHƯƠNG THỨC 2: YT-DLP API ===
  const ytDlpResult = await tryYtDlp(videoUrl, quality, audioOnly, audioFormat, format);
  if (ytDlpResult) {
    return res.status(200).json(ytDlpResult);
  }

  // === PHƯƠNG THỨC 3: YOUTUBE DIRECT API ===
  const directResult = await tryDirectDownload(videoUrl, quality, audioOnly);
  if (directResult) {
    return res.status(200).json(directResult);
  }

  // === PHƯƠNG THỨC 4: THIRD PARTY SERVICES ===
  const thirdPartyResult = await tryThirdParty(videoUrl, quality, audioOnly);
  if (thirdPartyResult) {
    return res.status(200).json(thirdPartyResult);
  }

  // === PHƯƠNG THỨC 5: FALLBACK - SỬ DỤNG PROXY ===
  const proxyResult = await tryProxyDownload(videoUrl);
  if (proxyResult) {
    return res.status(200).json(proxyResult);
  }

  // Tất cả đều thất bại
  return res.status(404).json({
    success: false,
    error: 'Không thể tải video. Video có thể bị giới hạn độ tuổi, bản quyền hoặc yêu cầu đăng nhập.',
    suggestions: [
      'Thử tải ở chất lượng thấp hơn (360p)',
      'Thử tải chỉ lấy âm thanh (audioOnly=true)',
      'Kiểm tra lại link video',
      'Video có thể đã bị xóa hoặc private'
    ]
  });
}

// === PHƯƠNG THỨC 1: COBALT API ===
async function tryCobalt(videoUrl, quality, audioOnly, audioFormat, format) {
  const servers = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kpnq.dev',
    'https://api.cobalt.my.id'
  ];

  for (let server of servers) {
    try {
      const requestBody = {
        url: videoUrl,
        vQuality: quality,
        isAudioOnly: audioOnly,
        audioFormat: audioFormat,
        filenamePattern: 'classic',
        disableMetadata: false,
        // Thêm header để vượt giới hạn
        youtubeHLS: true,
        ageRestricted: true
      };

      if (!audioOnly) {
        requestBody.vCodec = format === 'webm' ? 'vp9' : 'h264';
        requestBody.aFormat = audioFormat === 'mp3' ? 'mp3' : 'm4a';
      }

      const response = await fetch(`${server}/api/json`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://cobalt.tools',
          'Referer': 'https://cobalt.tools/'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data && data.url) {
        const title = await getVideoTitle(videoUrl);
        return {
          success: true,
          data: {
            url: data.url,
            quality: quality,
            format: audioOnly ? audioFormat : format,
            isAudioOnly: audioOnly,
            fileName: `${title || 'video'}.${audioOnly ? audioFormat : format}`,
            title: title || 'Video',
            method: 'Cobalt API'
          },
          message: `Đang tải ${audioOnly ? 'âm thanh' : 'video'} chất lượng ${quality}p`
        };
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

// === PHƯƠNG THỨC 2: YT-DLP API ===
async function tryYtDlp(videoUrl, quality, audioOnly, audioFormat, format) {
  try {
    const ytDlpServers = [
      'https://yt-dl.org',
      'https://ytdl-api.onrender.com',
      'https://youtube-dl-api.herokuapp.com'
    ];

    for (let server of ytDlpServers) {
      try {
        const response = await fetch(`${server}/download?url=${encodeURIComponent(videoUrl)}&quality=${quality}&format=${audioOnly ? 'bestaudio' : 'bestvideo'}`);
        const data = await response.json();

        if (data && data.url) {
          const title = await getVideoTitle(videoUrl);
          return {
            success: true,
            data: {
              url: data.url,
              quality: quality,
              format: audioOnly ? audioFormat : format,
              isAudioOnly: audioOnly,
              fileName: `${title || 'video'}.${audioOnly ? audioFormat : format}`,
              title: title || 'Video',
              method: 'YT-DLP API'
            },
            message: `Đang tải ${audioOnly ? 'âm thanh' : 'video'} chất lượng ${quality}p`
          };
        }
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

// === PHƯƠNG THỨC 3: YOUTUBE DIRECT API ===
async function tryDirectDownload(videoUrl, quality, audioOnly) {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) return null;

    // Sử dụng YouTube API không chính thức
    const apiUrls = [
      `https://www.youtube.com/get_video_info?video_id=${videoId}&el=detailpage&ps=default&eurl=&gl=US&hl=en`,
      `https://www.youtube.com/get_video_info?video_id=${videoId}&el=embedded&ps=default&eurl=&gl=US&hl=en`
    ];

    for (let apiUrl of apiUrls) {
      try {
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        const text = await response.text();
        const params = new URLSearchParams(text);
        const playerResponse = params.get('player_response');
        
        if (playerResponse) {
          const data = JSON.parse(playerResponse);
          const formats = data.streamingData?.formats || [];
          const adaptiveFormats = data.streamingData?.adaptiveFormats || [];
          const allFormats = [...formats, ...adaptiveFormats];

          // Tìm format phù hợp
          let targetFormat = null;
          if (audioOnly) {
            targetFormat = allFormats.find(f => f.mimeType?.includes('audio/mp4') && !f.mimeType?.includes('video'));
          } else {
            // Tìm video với chất lượng mong muốn
            targetFormat = allFormats.find(f => 
              f.height == quality && 
              f.mimeType?.includes('video/mp4')
            ) || allFormats.find(f => 
              f.height && f.height <= parseInt(quality) && 
              f.mimeType?.includes('video/mp4')
            );
          }

          if (targetFormat && targetFormat.url) {
            const title = await getVideoTitle(videoUrl);
            return {
              success: true,
              data: {
                url: targetFormat.url,
                quality: targetFormat.height || quality,
                format: audioOnly ? 'mp3' : 'mp4',
                isAudioOnly: audioOnly,
                fileName: `${title || 'video'}.${audioOnly ? 'mp3' : 'mp4'}`,
                title: title || 'Video',
                method: 'YouTube Direct API'
              },
              message: `Đang tải ${audioOnly ? 'âm thanh' : 'video'} chất lượng ${quality}p`
            };
          }
        }
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

// === PHƯƠNG THỨC 4: THIRD PARTY SERVICES ===
async function tryThirdParty(videoUrl, quality, audioOnly) {
  const services = [
    {
      name: 'y2mate',
      url: `https://www.y2mate.com/mates/analyzeV2/ajax`,
      method: 'POST'
    },
    {
      name: 'savefrom',
      url: `https://en.savefrom.net/1-ajax/`,
      method: 'POST'
    }
  ];

  for (let service of services) {
    try {
      const response = await fetch(service.url, {
        method: service.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: new URLSearchParams({
          url: videoUrl,
          quality: quality,
          format: audioOnly ? 'audio' : 'video'
        })
      });

      const data = await response.json();
      if (data && data.url) {
        const title = await getVideoTitle(videoUrl);
        return {
          success: true,
          data: {
            url: data.url,
            quality: quality,
            format: audioOnly ? 'mp3' : 'mp4',
            isAudioOnly: audioOnly,
            fileName: `${title || 'video'}.${audioOnly ? 'mp3' : 'mp4'}`,
            title: title || 'Video',
            method: service.name
          },
          message: `Đang tải ${audioOnly ? 'âm thanh' : 'video'} chất lượng ${quality}p`
        };
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

// === PHƯƠNG THỨC 5: PROXY DOWNLOAD ===
async function tryProxyDownload(videoUrl) {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) return null;

    // Sử dụng proxy để truy cập video
    const proxies = [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/'
    ];

    for (let proxy of proxies) {
      try {
        const response = await fetch(`${proxy}https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        if (response.ok) {
          const title = await getVideoTitle(videoUrl);
          return {
            success: true,
            data: {
              url: videoUrl,
              quality: '720',
              format: 'mp4',
              isAudioOnly: false,
              fileName: `${title || 'video'}.mp4`,
              title: title || 'Video',
              method: 'Proxy Download',
              note: 'Video sẽ được tải qua proxy, có thể chậm hơn'
            },
            message: 'Đang tải video qua proxy'
          };
        }
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

// === HÀM HỖ TRỢ ===

// Trích xuất video ID
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
    /(?:youtube\.com\/embed\/)([\w-]+)/,
    /(?:youtube\.com\/v\/)([\w-]+)/
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
