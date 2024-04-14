import ofetch from '@/utils/ofetch';
import { config } from '@/config';
import cache from '@/utils/cache';

const headers = {
    origin: 'https://fanbox.cc',
    cookie: config.fanbox.session ? `FANBOXSESSID=${config.fanbox.session}` : '',
};

const getTwitter = async (t) => {
    try {
        const resp = await ofetch(`https://publish.twitter.com/oembed?url=${t}`);
        return resp.html;
    } catch {
        return `<div style="border-style:solid;border-width:0.5px;padding:0.5em;">This tweet may not exist</div>`;
    }
};

const getFanbox = async (p) => {
    try {
        const m = p.match(/creator\/(\d+)\/post\/(\d+)/);
        const post_id = m[2];
        const resp = await ofetch(`https://api.fanbox.cc/post.info?postId=${post_id}`, { headers });
        const post = resp.body;

        const home_url = `https://${post.creatorId}.fanbox.cc`;
        const web_url = `${home_url}/posts/${post.id}`;
        const datetime = new Date(post.updatedDatetime).toLocaleString('ja');

        const box_html = `
            <div style="width:640px;padding:0.5em;border-style:solid;border-width:0.5px">
                <img width=300 src="${post.imageForShare}" />
                <br/>
                <a href="${web_url}" style="font-weight:bold">${post.title}</a>
                <br/>
                <br/>
                <a href="${home_url}" style="margin-right:1.6em">${post.user.name}</a>
                <span style="margin-right:1.6em">Modify: ${datetime}</span>
                <span>${post.feeRequired} JPY</span>
            </div>
        `;
        return { url: web_url, html: box_html };
    } catch {
        return { url: null, html: `<div style="border-style:solid;border-width:0.5px;padding:0.5em;">fanbox post (${p}) may not exist</div>` };
    }
};

// embedded items
const embedMap = async (e) => {
    const id = e.contentId || e.videoId;
    const sp = e.serviceProvider;

    let ret = `Unknown host: ${sp}, with ID: ${id}`;
    let url = '';

    try {
        switch (sp) {
            case 'youtube':
                url = `https://www.youtube.com/embed/${id}`;
                ret = `<iframe type="text/html" width="640" height="360" src="${url}" frameborder="0" allowfullscreen></iframe>`;
                break;
            case 'vimeo':
                url = `https://player.vimeo.com/video/${id}`;
                ret = `<iframe type="text/html" width="640" height="360" src="${url}" frameborder="0" allowfullscreen></iframe>`;
                break;
            case 'soundcloud':
                url = `https://soundcloud.com/${id}`;
                ret = `<iframe width="640" height="166" frameborder="0" allowfullscreen src="https://w.soundcloud.com/player/?url=${url}"></iframe>`;
                break;
            case 'twitter':
                url = `https://twitter.com/i/status/${id}`;
                ret = await getTwitter(url);
                break;
            case 'google_forms':
                url = `https://docs.google.com/forms/d/e/${id}/viewform?embedded=true`;
                ret = `<iframe src="${url}" width=640 height=800 frameborder="0" allowfullscreen></iframe>`;
                break;
            case 'fanbox': {
                const info = await getFanbox(id);
                url = info.url || '';
                ret = info.html;
                break;
            }
            case 'gist':
                url = `https://gist.github.com/${id}`;
                ret = `<iframe frameborder="0" width="640" height="480" srcdoc="<script src=${url}.js></script>"></iframe>`;
                break;
        }
        if (url) {
            ret += `<br/><a href="${url}" style="font-size:0.6em;">Click here if embedded content is not loaded.</a>`;
        }
    } catch (error) {
        error;
    }

    return ret;
};

// render <p/> blocks
const passageConv = (p) => {
    const seg = [...p.text];
    // seg.push('');
    if (p.styles) {
        p.styles.map((s) => {
            switch (s.type) {
                case 'bold':
                    seg[s.offset] = `<b>` + seg[s.offset];
                    seg[s.offset + s.length - 1] += `</b>`;
                    break;
            }
            return s;
        });
    }
    if (p.links) {
        p.links.map((l) => {
            seg[l.offset] = `<a href="${l.url}">` + seg[l.offset];
            seg[l.offset + l.length - 1] += `</a>`;
            return l;
        });
    }
    const ret = seg.join('');
    return ret;
};

// article types
const textT = (body) => body.text || '';

const imageT = (body) => {
    let ret = body.text || '';
    body.images.map((i) => (ret += `<hr><img src="${i.originalUrl}">`));
    return ret;
};

const fileT = (body) => {
    let ret = body.text || '';
    body.files.map((f) => (ret += `<br><a href="${f.url}" download="${f.name}.${f.extension}">${f.name}.${f.extension}</a>`));
    return ret;
};

const videoT = async (body) => {
    let ret = body.text || '';
    ret += (await embedMap(body.video)) || '';
    return ret;
};

/* eslint-disable no-await-in-loop */
const blogT = async (body) => {
    let ret: string[] = [];
    for (const b of body.blocks) {
        ret.push('<p>');

        switch (b.type) {
            case 'p':
                ret.push(passageConv(b));
                break;
            case 'header':
                ret.push(`<h2>${b.text}</h2>`);
                break;
            case 'image': {
                const i = body.imageMap[b.imageId || ''];
                ret.push(`<img src="${i.originalUrl}">`);
                break;
            }
            case 'file': {
                const f = body.fileMap[b.fileId || ''];
                ret.push(`<a href="${f.url}" download="${f.name}.${f.extension}">${f.name}.${f.extension}</a>`);
                break;
            }
            case 'embed':
                ret.push(await embedMap(body.embedMap[b.embedId || ''])); // Promise object
                break;
        }
    }
    ret = await Promise.all(ret); // get real data
    return ret.join('');
};

// parse by type
const convArticle = async (i) => {
    const items = await cache.tryGet(`https://${i.creatorId}.fanbox.cc/posts/${i.id}`, async () => {
        let ret = '';
        const resp = await ofetch(`https://api.fanbox.cc/post.info?postId=${i.id}`, { headers });
        const post = resp.body;

        if (i.title) {
            ret += `${i.title}<hr>`;
        }
        if (i.feeRequired !== 0) {
            ret += `Fee Required: <b>${i.feeRequired} JPY/month</b><hr>`;
        }
        if (i.cover.url) {
            ret += `<img src="${i.cover.url}"><hr>`;
        }

        if (!post.body) {
            ret += i.excerpt;
            return {
                title: i.title || 'No title',
                description: ret,
                pubDate: new Date(i.publishedDatetime).toUTCString(),
                link: `https://${i.creatorId}.fanbox.cc/posts/${i.id}`,
                category: i.tags,
            };
        }

        // skip paywall

        switch (post.type) {
            case 'text':
                ret += textT(post.body);
                break;
            case 'file':
                ret += fileT(post.body);
                break;
            case 'image':
                ret += imageT(post.body);
                break;
            case 'video':
                ret += await videoT(post.body);
                break;
            case 'article':
                ret += await blogT(post.body);
                break;
            default:
                ret += '<b>Unsupported content (RSSHub)</b>';
        }
        return {
            title: i.title || 'No title',
            description: ret,
            pubDate: new Date(i.publishedDatetime).toUTCString(),
            link: `https://${i.creatorId}.fanbox.cc/posts/${i.id}`,
            category: i.tags,
        };
    });
    return items;
};

export { convArticle, headers };
