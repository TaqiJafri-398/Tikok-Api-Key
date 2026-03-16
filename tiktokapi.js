export default {
  async fetch(request) {

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);
    const input = url.searchParams.get("url");

    if (!input) {
      return new Response(JSON.stringify({
        status: "error",
        message: "TikTok URL parameter required",
        example: "?url=https://www.tiktok.com/@user/video/123456"
      }, null, 2), { headers });
    }

    if (!isValidTikTokUrl(input)) {
      return new Response(JSON.stringify({
        status: "error",
        message: "Invalid TikTok URL"
      }, null, 2), { headers });
    }

    try {

      const finalUrl = await resolveShortUrl(input);

      const page = await fetch(finalUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      if (!page.ok) {
        throw new Error("Failed to fetch TikTok page");
      }

      const html = await page.text();

      const jsonMatch = html.match(
        /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/
      );

      if (!jsonMatch) {
        throw new Error("TikTok JSON data not found");
      }

      const json = JSON.parse(jsonMatch[1]);

      const item =
        json?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;

      if (!item) {
        throw new Error("Video data not found");
      }

      const video = item.video || {};
      const author = item.author || {};
      const stats = item.stats || {};
      const music = item.music || {};

      const images = item.imagePost?.images || [];

      const result = {
        status: "success",
        type: images.length ? "photo" : "video",
        id: item.id,
        description: item.desc,
        created: item.createTime,
        author: {
          id: author.id,
          username: author.uniqueId,
          nickname: author.nickname,
          avatar: author.avatarLarger
        },
        stats: {
          likes: stats.diggCount,
          comments: stats.commentCount,
          shares: stats.shareCount,
          views: stats.playCount
        },
        music: {
          title: music.title,
          author: music.authorName,
          url: music.playUrl
        }
      };

      if (images.length) {

        result.images = images.map(img => img.imageURL.urlList[0]);

      } else {

        result.video = {
          cover: video.cover,
          dynamicCover: video.dynamicCover,
          download: video.downloadAddr,
          play: video.playAddr,
          bitrate: video.bitrate
        };

      }

      return new Response(JSON.stringify(result, null, 2), { headers });

    } catch (err) {

      return new Response(JSON.stringify({
        status: "error",
        message: err.message
      }, null, 2), { headers });

    }

  }
};



function isValidTikTokUrl(url) {

  const patterns = [
    /tiktok\.com\/.*\/video\//,
    /tiktok\.com\/.*\/photo\//,
    /vt\.tiktok\.com\/.*/,
    /vm\.tiktok\.com\/.*/
  ];

  return patterns.some(r => r.test(url));
}



async function resolveShortUrl(url) {

  if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {

    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    return res.url;
  }

  return url;
}
