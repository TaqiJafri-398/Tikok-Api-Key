export default {
  async fetch(req) {

    const headers = {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    };

    try {

      const url = new URL(req.url);
      const input = url.searchParams.get("url");
      const download = url.searchParams.get("download");

      if (!input) {
        return new Response(JSON.stringify({
          status: "error",
          message: "TikTok URL required"
        }), { headers });
      }

      const cleaned = cleanUrl(input);
      const finalUrl = await resolveShort(cleaned);

      const html = await fetchPage(finalUrl);

      const json = extractSIGI(html);

      const itemModule = json.ItemModule;
      const id = Object.keys(itemModule)[0];
      const item = itemModule[id];

      const video = item.video || {};
      const music = item.music || {};
      const stats = item.stats || {};
      const author =
        json.UserModule?.users?.[item.author] || {};

      const images =
        item.imagePost?.images?.map(
          i => i.imageURL.urlList[0]
        ) || [];

      const play =
        video.playAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
        null;

      const wmplay =
        video.downloadAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
        null;

      // STREAM DOWNLOAD
      if (download && play) {

        const videoStream = await fetch(play);

        return new Response(videoStream.body, {
          headers: {
            "content-type": "video/mp4",
            "content-disposition":
              `attachment; filename=tiktok_${id}.mp4`,
            "access-control-allow-origin": "*"
          }
        });

      }

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
          shares: stats.shareCount,
          downloads: stats.downloadCount
        },

        video: images.length ? null : {
          play,
          wmplay,
          download:
            `${url.origin}?url=${encodeURIComponent(finalUrl)}&download=1`
        },

        slideshow: images.length ? images : null,

        music: {
          id: music.id,
          title: music.title,
          author: music.authorName,
          play: music.playUrl,
          duration: music.duration,
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



/* -------- FUNCTIONS -------- */

function cleanUrl(url) {
  return url.split("?")[0];
}


async function resolveShort(url) {

  if (
    url.includes("vt.tiktok.com") ||
    url.includes("vm.tiktok.com") ||
    url.includes("tiktok.com/t/")
  ) {

    const r = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0" }
    });

    return r.url;
  }

  return url;
}


async function fetchPage(url) {

  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
      "referer": "https://www.tiktok.com/"
    }
  });

  return await res.text();
}


function extractSIGI(html) {

  const match = html.match(
    /<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/
  );

  if (!match) {
    throw new Error("TikTok data not found");
  }

  return JSON.parse(match[1]);
}
