export default {
  async fetch(req) {

    const headers = {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    };

    try {

      const url = new URL(req.url);
      const input = url.searchParams.get("url");

      if (!input) {
        return new Response(JSON.stringify({
          status: "error",
          message: "TikTok URL required"
        }), { headers });
      }

      // normalize link
      const cleaned = cleanUrl(input);

      // resolve vt/vm/t short links
      const finalUrl = await resolveShort(cleaned);

      // fetch tiktok page
      const page = await fetch(finalUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
          "referer": "https://www.tiktok.com/"
        }
      });

      const html = await page.text();

      const match = html.match(
        /<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/
      );

      if (!match) {
        throw new Error("TikTok data not found");
      }

      const json = JSON.parse(match[1]);

      const itemModule = json.ItemModule;
      const id = Object.keys(itemModule)[0];
      const item = itemModule[id];

      const video = item.video || {};
      const music = item.music || {};
      const stats = item.stats || {};

      const author =
        json.UserModule?.users?.[item.author] || {};

      // slideshow
      const images =
        item.imagePost?.images?.map(
          img => img.imageURL.urlList[0]
        ) || [];

      // video links
      const play =
        video.playAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
        null;

      const wmplay =
        video.downloadAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
        null;

      const response = {

        status: "success",

        id,

        title: item.desc,

        region: item.region,

        duration: video.duration,

        cover: video.cover,

        author: {
          id: author.id,
          username: author.uniqueId,
          nickname: author.nickname,
          avatar: author.avatarMedium
        },

        stats: {
          views: stats.playCount,
          likes: stats.diggCount,
          comments: stats.commentCount,
          shares: stats.shareCount
        },

        video: images.length ? null : {
          play,
          wmplay
        },

        slideshow: images.length ? images : null,

        music: {
          id: music.id,
          title: music.title,
          author: music.authorName,
          play: music.playUrl,
          cover: music.coverLarge
        }

      };

      return new Response(
        JSON.stringify(response, null, 2),
        { headers }
      );

    } catch (err) {

      return new Response(JSON.stringify({
        status: "error",
        message: err.message
      }), { headers });

    }

  }
};



/* ---------- FUNCTIONS ---------- */

// remove query parameters
function cleanUrl(url) {
  return url.split("?")[0];
}

// resolve short links
async function resolveShort(url) {

  if (
    url.includes("vt.tiktok.com") ||
    url.includes("vm.tiktok.com") ||
    url.includes("tiktok.com/t/")
  ) {

    const r = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    return r.url;
  }

  return url;

}
