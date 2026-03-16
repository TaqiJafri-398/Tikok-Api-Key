export default {
  async fetch(req) {

    const headers = {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    };

    try {

      const requestUrl = new URL(req.url);
      const input = requestUrl.searchParams.get("url");
      const download = requestUrl.searchParams.get("download");

      if (!input) {
        return json({status:"error", message:"TikTok URL required"});
      }

      const clean = input.split("?")[0];
      const resolved = await resolveShort(clean);

      const html = await fetchPage(resolved);

      const match = html.match(
        /<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/
      );

      if (!match) {
        throw new Error("TikTok data not found");
      }

      const data = JSON.parse(match[1]);

      const itemModule = data.ItemModule;
      const id = Object.keys(itemModule)[0];
      const item = itemModule[id];

      const video = item.video || {};
      const music = item.music || {};
      const stats = item.stats || {};

      const author =
        data.UserModule?.users?.[item.author] || {};

      const slideshow =
        item.imagePost?.images?.map(
          img => img.imageURL.urlList[0]
        ) || [];

      const play =
        video.playAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
        null;

      const wmplay =
        video.downloadAddr ||
        video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
        null;

      if (download && play) {

        const stream = await fetch(play);

        return new Response(stream.body,{
          headers:{
            "content-type":"video/mp4",
            "content-disposition":`attachment; filename=tiktok_${id}.mp4`,
            "access-control-allow-origin":"*"
          }
        });

      }

      return json({

        status:"success",

        id,

        title:item.desc,

        duration:video.duration,

        cover:video.cover,

        author:{
          id:author.id,
          username:author.uniqueId,
          nickname:author.nickname,
          avatar:author.avatarMedium
        },

        stats:{
          views:stats.playCount,
          likes:stats.diggCount,
          comments:stats.commentCount,
          shares:stats.shareCount
        },

        video: slideshow.length ? null : {
          play,
          wmplay,
          download:
          `${requestUrl.origin}?url=${encodeURIComponent(resolved)}&download=1`
        },

        slideshow: slideshow.length ? slideshow : null,

        music:{
          id:music.id,
          title:music.title,
          author:music.authorName,
          play:music.playUrl,
          duration:music.duration,
          cover:music.coverLarge
        }

      });

    }

    catch(err){

      return json({
        status:"error",
        message:err.message
      });

    }

  }
};


function json(data){
  return new Response(JSON.stringify(data,null,2),{
    headers:{
      "content-type":"application/json",
      "access-control-allow-origin":"*"
    }
  });
}


async function resolveShort(url){

  if(
    url.includes("vt.tiktok.com") ||
    url.includes("vm.tiktok.com") ||
    url.includes("tiktok.com/t/")
  ){

    const r = await fetch(url,{
      redirect:"follow",
      headers:{ "user-agent":"Mozilla/5.0" }
    });

    return r.url;
  }

  return url;

}


async function fetchPage(url){

  const res = await fetch(url,{
    headers:{
      "user-agent":"Mozilla/5.0",
      "referer":"https://www.tiktok.com/"
    }
  });

  return await res.text();

}
