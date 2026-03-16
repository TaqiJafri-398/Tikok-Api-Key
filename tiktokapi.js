export default {
  async fetch(request) {

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    };

    const url = new URL(request.url);
    const input = url.searchParams.get("url");

    if (!input) {
      return new Response(JSON.stringify({
        status: "error",
        message: "TikTok URL required"
      }), { headers });
    }

    try {

      const finalUrl = await resolveShortUrl(input);

      const page = await fetch(finalUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.tiktok.com/"
        }
      });

      const html = await page.text();

      const jsonMatch = html.match(
        /<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/
      );

      if (!jsonMatch) throw new Error("TikTok data not found");

      const data = JSON.parse(jsonMatch[1]);

      const itemModule = data.ItemModule;
      const itemId = Object.keys(itemModule)[0];
      const item = itemModule[itemId];

      const video = item.video || {};
      const music = item.music || {};
      const author = data.UserModule.users[item.author];

      const images = item.imagePost?.images || [];

      const videoPlay =
        video.playAddr ||
        video.downloadAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];

      const wmPlay =
        video.downloadAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];

      const slideshow =
        images.map(img => img.imageURL.urlList[0]);

      const response = {

        status: "success",

        id: itemId,

        title: item.desc,

        duration: video.duration,

        cover: video.cover,

        region: item.region,

        stats: {
          views: item.stats.playCount,
          likes: item.stats.diggCount,
          comments: item.stats.commentCount,
          shares: item.stats.shareCount,
          downloads: item.stats.downloadCount
        },

        author: {
          id: author.id,
          username: author.uniqueId,
          nickname: author.nickname,
          avatar: author.avatarMedium
        },

        video: images.length
          ? null
          : {
              play: videoPlay,
              wmplay: wmPlay,
              size: video.playAddrSize
            },

        slideshow: images.length
          ? slideshow
          : null,

        music: {
          id: music.id,
          title: music.title,
          author: music.authorName,
          play: music.playUrl,
          duration: music.duration,
          cover: music.coverLarge
        }

      };

      return new Response(JSON.stringify(response, null, 2), { headers });

    } catch (err) {

      return new Response(JSON.stringify({
        status: "error",
        message: err.message
      }), { headers });

    }

  }
};


/* ---------- HELPERS ---------- */

async function resolveShortUrl(url) {

  if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {

    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    return res.url;
  }

  return url;

}
