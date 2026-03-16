export default {
  async fetch(request) {

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const input = url.searchParams.get("url");
    const download = url.searchParams.get("download");

    if (!input) {
      return json({
        status: "error",
        message: "TikTok URL required",
        example: "?url=https://www.tiktok.com/@user/video/123"
      });
    }

    if (!isValidTikTokUrl(input)) {
      return json({
        status: "error",
        message: "Invalid TikTok URL"
      });
    }

    try {

      const finalUrl = await resolveShortUrl(input);

      const page = await fetch(finalUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": "https://www.tiktok.com/"
        }
      });

      const html = await page.text();

      const jsonMatch = html.match(
        /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/
      );

      if (!jsonMatch) throw new Error("TikTok data not found");

      const data = JSON.parse(jsonMatch[1]);

      const item =
        data?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;

      if (!item) throw new Error("Video info not found");

      const video = item.video || {};
      const music = item.music || {};
      const author = item.author || {};
      const stats = item.stats || {};
      const images = item.imagePost?.images || [];

      const videoUrl =
        video.playAddr?.urlList?.[0] ||
        video.downloadAddr?.urlList?.[0];

      const audioUrl = music.playUrl;

      const apiBase =
        `${request.origin}${url.pathname}?url=${encodeURIComponent(input)}`;

      /* ---------- STREAM VIDEO ---------- */

      if (download === "video") {

        const res = await fetch(videoUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.tiktok.com/",
            "Range": "bytes=0-"
          }
        });

        return new Response(res.body, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="${item.id}.mp4"`
          }
        });
      }

      /* ---------- STREAM AUDIO ---------- */

      if (download === "audio") {

        const res = await fetch(audioUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.tiktok.com/"
          }
        });

        return new Response(res.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Disposition": `attachment; filename="${item.id}.mp3"`
          }
        });
      }

      /* ---------- PHOTO SLIDESHOW ---------- */

      let imageUrls = [];

      if (images.length) {
        imageUrls = images.map(img => img.imageURL.urlList[0]);
      }

      /* ---------- RESPONSE JSON ---------- */

      return json({
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
          url: music.playUrl,
          download: `${apiBase}&download=audio`
        },

        video: images.length
          ? null
          : {
              cover: video.cover,
              dynamicCover: video.dynamicCover,
              play: videoUrl,
              download: `${apiBase}&download=video`
            },

        images: imageUrls
      });

    } catch (err) {

      return json({
        status: "error",
        message: err.message
      });

    }
  }
};


/* ---------- HELPERS ---------- */

function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}


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
        "User-Agent": "Mozilla/5.0"
      }
    });

    return res.url;
  }

  return url;
}
